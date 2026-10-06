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
  started_at: string | null
  ended_at: string | null
}

type EventT = { title: string; start: Date; end: Date; session: Session; color: string }

function localDate(s: string, hour: number) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, hour, 0)
}

const pad = (n: number) => String(n).padStart(2, '0')

export default function CalendarPage() {
  const router = useRouter()
  const [events, setEvents] = useState<EventT[]>([])
  const [selected, setSelected] = useState<Session | null>(null)
  const [confidence, setConfidence] = useState(3)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0) // seconds since Start was pressed

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

  // Live clock while a session is running
  useEffect(() => {
    if (!selected?.started_at || selected.ended_at) { setElapsed(0); return }
    const begin = new Date(selected.started_at).getTime()
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - begin) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [selected?.started_at, selected?.ended_at])

  async function generate() {
    setBusy(true); setMsg('')
    try {
      const r = await replan(new Date().toLocaleDateString('en-CA'))
      setMsg(`Plan updated: ${r.missed} missed sessions rescheduled, ${r.created} new sessions created`)
      await load()
    } catch (e: any) { setMsg('Error: ' + e.message) }
    setBusy(false)
  }

  async function startStudying() {
    if (!selected) return
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('study_sessions')
      .update({ started_at: now, ended_at: null })
      .eq('id', selected.id)
    if (error) { setMsg('Error: ' + error.message); return }
    setSelected({ ...selected, started_at: now, ended_at: null })
    await load()
  }

  async function markDone() {
    if (!selected) return

    // If the timer is running, save the end time first
    if (selected.started_at && !selected.ended_at) {
      const { error: endErr } = await supabase
        .from('study_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', selected.id)
      if (endErr) { setMsg('Error: ' + endErr.message); return }
    }

    const { error } = await supabase.rpc('complete_session', {
      p_session_id: selected.id, p_confidence: confidence,
    })
    if (error) setMsg('Error: ' + error.message)
    else setMsg(confidence <= 2 ? 'Marked done. Revision sessions were added.' : 'Marked done!')
    setSelected(null)
    await load()
  }

  // Text for sessions that already have both start and end times
  const studiedText = (() => {
    if (!selected?.started_at || !selected.ended_at) return ''
    const mins = Math.round(
      (new Date(selected.ended_at).getTime() - new Date(selected.started_at).getTime()) / 60000
    )
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  })()

  const running = !!selected?.started_at && !selected?.ended_at
  const clock = `${pad(Math.floor(elapsed / 3600))}:${pad(Math.floor((elapsed % 3600) / 60))}:${pad(elapsed % 60)}`

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

            {/* Study timer */}
            <div className="mt-4 rounded-lg bg-gray-50 p-3">
              <h3 className="mb-1 text-sm font-semibold">Study timer</h3>

              {studiedText ? (
                <p className="text-sm text-green-700">
                  Studied for {studiedText}
                  {selected.started_at && selected.ended_at && (
                    <span className="block text-xs text-gray-500">
                      {new Date(selected.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      {' to '}
                      {new Date(selected.ended_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </p>
              ) : running ? (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl">{clock}</span>
                  <span className="text-xs text-gray-500">
                    Started {new Date(selected.started_at!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.
                    Press Mark done when you finish.
                  </span>
                </div>
              ) : selected.status !== 'done' ? (
                <button onClick={startStudying}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700">
                  Start studying
                </button>
              ) : (
                <p className="text-xs text-gray-500">No study time was recorded for this session.</p>
              )}
            </div>

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
                  {running ? 'Stop & mark done' : 'Mark done'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}