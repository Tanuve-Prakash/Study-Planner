import { supabase } from '@/lib/supabase'

export type SessionRow = {
  user_id: string
  topic_id: string | null
  assignment_id: string | null
  session_date: string
  start_hour: number
  duration_hours: number
  session_type: 'study' | 'assignment'
  status: 'planned'
  priority_score: number
  reason: string
}

type Unit = {
  topic_id: string | null
  assignment_id: string | null
  lastDay: string
  score: number
  reason: string
  type: 'study' | 'assignment'
}

// ---------- local date helpers (no toISOString, so India dates stay correct) ----------
function fmt(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function addDays(s: string, n: number): string {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return fmt(d)
}
function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000)
}

// ---------- build the schedule ----------
export async function generateSchedule(today: string): Promise<SessionRow[]> {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) throw new Error('Not logged in')

  // 1. Topics sorted by priority (with reason text)
  const { data: topics, error: tErr } = await supabase.rpc('topic_priorities', { p_today: today })
  if (tErr) { console.error(tErr); throw tErr }

  // 2. Daily hours
  const { data: profile } = await supabase
    .from('profiles').select('daily_hours').eq('id', user.id).single()
  const dailyHours = Math.max(1, Math.floor(Number(profile?.daily_hours ?? 3)))

  // 3. Pending assignments
  const { data: assignments } = await supabase
    .from('assignments')
    .select('id, title, due_date, estimated_hours')
    .eq('status', 'pending')
    .gte('due_date', today)

  // 4. Rest days
  const { data: rest } = await supabase.from('rest_days').select('rest_date')
  const restSet = new Set((rest ?? []).map((r: any) => r.rest_date as string))

  // 5. Build 1-hour units
  const units: Unit[] = []

  for (const t of topics ?? []) {
    const n = Math.max(1, Math.ceil(Number(t.estimated_hours) || 1))
    for (let i = 0; i < n; i++) {
      units.push({
        topic_id: t.topic_id,
        assignment_id: null,
        lastDay: addDays(t.exam_date, -1), // study before the exam day
        score: Number(t.priority_score),
        reason: t.reason,
        type: 'study',
      })
    }
  }

  for (const a of assignments ?? []) {
    const left = daysBetween(today, a.due_date)
    const n = Math.max(1, Math.ceil(Number(a.estimated_hours) || 1))
    const score = 6 + 10 / Math.max(left, 1)
    for (let i = 0; i < n; i++) {
      units.push({
        topic_id: null,
        assignment_id: a.id,
        lastDay: a.due_date,
        score,
        reason: `Assignment "${a.title}" is due in ${left} day(s)`,
        type: 'assignment',
      })
    }
  }

  if (units.length === 0) return []

  // highest priority first
  units.sort((x, y) => y.score - x.score)

  // 6. Fill each day
  const lastDayOverall = units.reduce((m, u) => (u.lastDay > m ? u.lastDay : m), today)
  const rows: SessionRow[] = []
  let day = today
  let guard = 0

  while (day <= lastDayOverall && units.length > 0 && guard < 90) {
    guard++
    if (!restSet.has(day)) {
      let hour = 9
      for (let slot = 0; slot < dailyHours; slot++) {
        const idx = units.findIndex(u => u.lastDay >= day)
        if (idx === -1) break
        const u = units.splice(idx, 1)[0]
        rows.push({
          user_id: user.id,
          topic_id: u.topic_id,
          assignment_id: u.assignment_id,
          session_date: day,
          start_hour: hour++,
          duration_hours: 1,
          session_type: u.type,
          status: 'planned',
          priority_score: u.score,
          reason: u.reason,
        })
      }
    }
    day = addDays(day, 1)
  }

  return rows
}

// ---------- "I fell behind" / Generate plan ----------
export async function replan(today: string): Promise<{ missed: number; created: number }> {
  const { data: missedCount, error: e1 } = await supabase.rpc('mark_missed_sessions', { p_today: today })
  if (e1) { console.error(e1); throw e1 }

  const { error: e2 } = await supabase.rpc('clear_future_sessions', { p_today: today })
  if (e2) { console.error(e2); throw e2 }

  const rows = await generateSchedule(today)

  if (rows.length > 0) {
    const { error: e3 } = await supabase.from('study_sessions').insert(rows)
    if (e3) { console.error(e3); throw e3 }
  }

  const { error: e4 } = await supabase.rpc('save_readiness_snapshot', { p_today: today })
  if (e4) console.error(e4)

  return { missed: Number(missedCount) || 0, created: rows.length }
}