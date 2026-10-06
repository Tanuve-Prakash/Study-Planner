'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { supabase } from '@/lib/supabase'
import { replan } from '@/lib/scheduler'

const localizer = dateFnsLocalizer({
  format, parse, startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), getDay,
  locales: { 'en-US': enUS },
})

type Session = {
  id: string
  topic_id: string | null
  assignment_id: string | null
  session_date: string
  start_hour: number | null
  duration_hours: number
  session_type: string
  status: 'planned' | 'done' | 'missed'
  reason: string | null
  title: string
}

type EventT = { title: string; start: Date; end: Date; session: Session; color: string }

function localDate(s: string, hour: number) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, hour, 0)
}

export default function CalendarPage() {
  const router = useRouter()
  const [events, setEvents] = useState<EventT[]>([])
  const [selected, setSelected] = useState<Session | null>(null)
  const [confidence, setConfidence] = useState(3)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return router.push('/login')

    const { data: sessions } = await supabase.from('study_sessions').select('*')
    const { data: topics } = await supabase.from('topics').select('id, name, subject_id')
    const { data: subjects } = await supabase.from('subjects').select('id, name, color')
    const { data: assigns } = await supabase.from('assignments').select('id, title')

    const subjById = new Map((subjects ?? []).map((s: any) => [s.id, s]))
    const topicById = new Map((topics ?? []).map((t: any) => [t.id, t]))
    const assignById = new Map((assigns ?? []).map((a: any) => [a.id, a]))

    const list: EventT[] = (sessions ?? []).map((s: any) => {
      let title = 'Study'
      let subjName = ''
      if (s.topic_id) {
        const t: any = topicById.get(s.topic_id)
        const sub: any = t ? subjById.get(t.subject_id) : null
        subjName = sub?.name ?? ''
        title = `${subjName ? subjName + ': ' : ''}${t?.name ?? 'Topic'}${s.session_type === 'revision' ? ' (revision)' : ''}`
      } else if (s.assignment_id) {
        title = `Assignment: ${(assignById.get(s.assignment_id) as any)?.title ?? ''}`
      }
      const hour = s.start_hour ?? 9
      const color = s.status === 'done' ? '#16a34a' : s.status === 'missed' ? '#dc2626' : '#2563eb'
      return {
        title,
        start: localDate(s.session_date, hour),
        end: localDate(s.session_date, hour + Math.max(1, Math.round(s.duration_hours))),
        color,
        session: { ...s, title },
      }
    })
    setEvents(list)
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  async function generate() {
    setBusy(true); setMsg('')
    try {
      const r = await replan(new Date().toLocaleDateString('en-CA'))
      setMsg(`Plan updated: ${r.missed} missed sessions rescheduled, ${r.created} new sessions created`)
      await load()
    } catch (e: any) { setMsg('Error: ' + e.message) }
    setBusy(false)
  }

  async function markDone() {
    if (!selected) return
    const { error } = await supabase.rpc('complete_session', {
      p_session_id: selected.id, p_confidence: confidence,
    })
    if (error) setMsg('Error: ' + error.message)
    else setMsg(confidence <= 2 ? 'Marked done. Revision sessions were added.' : 'Marked done!')
    setSelected(null)
    await load()
  }

  return (
    <main className="mx-auto max-w-5xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-blue-700">Study Calendar</h1>
        <div className="flex gap-2">
          <button onClick={generate} disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? 'Planning...' : 'Generate plan'}
          </button>
          <button onClick={generate} disabled={busy}
            className="rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-50">
            I fell behind
          </button>
        </div>
      </div>

      {msg && <p className="mb-3 rounded bg-blue-50 p-2 text-blue-800">{msg}</p>}

      <div style={{ height: 600 }} className="rounded-lg border bg-white p-2">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          defaultView={Views.WEEK}
          onSelectEvent={(e: EventT) => { setSelected(e.session); setConfidence(3) }}
          eventPropGetter={(e: EventT) => ({ style: { backgroundColor: e.color, border: 'none' } })}
        />
      </div>

      <p className="mt-2 text-sm text-gray-600">
        <span className="text-blue-600">■</span> Planned &nbsp;
        <span className="text-green-600">■</span> Done &nbsp;
        <span className="text-red-600">■</span> Missed
      </p>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold">{selected.title}</h2>
            <p className="text-sm text-gray-500">
              {selected.session_date} · {selected.start_hour ?? 9}:00 · status: {selected.status}
            </p>

            <h3 className="mt-4 font-semibold text-blue-700">Why this session?</h3>
            <p className="rounded bg-blue-50 p-3 text-sm">{selected.reason ?? 'No reason saved.'}</p>

            {selected.status !== 'done' && (
              <div className="mt-4">
                <label className="block text-sm font-medium">How well did you understand it? (1 to 5)</label>
                <input type="range" min={1} max={5} value={confidence}
                  onChange={e => setConfidence(Number(e.target.value))} className="w-full" />
                <p className="text-center text-sm">Confidence: {confidence}/5</p>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setSelected(null)} className="rounded-lg border px-4 py-2">Close</button>
              {selected.status !== 'done' && (
                <button onClick={markDone} className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">
                  Mark done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}