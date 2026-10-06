'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { replan } from '@/lib/scheduler'

type Progress = {
  subject_id: string; name: string; color: string; exam_date: string
  days_left: number; total_topics: number; done_topics: number; progress_pct: number
}
type Readiness = {
  subject_id: string; subject_name: string; color: string; exam_date: string
  days_left: number; current_pct: number; projected_pct: number
  hours_needed: number; hours_available: number; status: 'on_track' | 'at_risk'
  explanation: string
}
type Assignment = { id: string; title: string; due_date: string }

const today = () => new Date().toLocaleDateString('en-CA')
const daysTo = (d: string) => {
  const [y, m, day] = d.split('-').map(Number)
  const [ty, tm, td] = today().split('-').map(Number)
  return Math.round((new Date(y, m - 1, day).getTime() - new Date(ty, tm - 1, td).getTime()) / 86400000)
}

export default function DashboardPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [progress, setProgress] = useState<Progress[]>([])
  const [readiness, setReadiness] = useState<Readiness[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [todayStats, setTodayStats] = useState({ planned: 0, done: 0, missed: 0, hours: 0 })
  const [pendingMissed, setPendingMissed] = useState(0)
  const [hours, setHours] = useState(3)
  const [simulating, setSimulating] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadAll() {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return router.push('/login')
    setEmail(auth.user.email ?? '')

    const { data: prof } = await supabase.from('profiles').select('daily_hours').eq('id', auth.user.id).single()
    if (prof?.daily_hours) setHours(Number(prof.daily_hours))

    const { data: p } = await supabase.from('subject_progress').select('*').order('exam_date')
    setProgress((p as Progress[]) ?? [])

    const { data: r } = await supabase.rpc('get_readiness', { p_today: today() })
    setReadiness((r as Readiness[]) ?? [])
    setSimulating(false)

    const { data: a } = await supabase
      .from('assignments').select('id,title,due_date')
      .eq('status', 'pending').gte('due_date', today()).order('due_date')
    setAssignments((a as Assignment[]) ?? [])

    const { data: s } = await supabase.from('study_sessions').select('session_date,status,duration_hours')
    const t = today()
    const rows = s ?? []
    const todayRows = rows.filter((x: any) => x.session_date === t)
    setTodayStats({
      planned: todayRows.filter((x: any) => x.status === 'planned').length,
      done: todayRows.filter((x: any) => x.status === 'done').length,
      missed: todayRows.filter((x: any) => x.status === 'missed').length,
      hours: todayRows.filter((x: any) => x.status === 'done').reduce((n: number, x: any) => n + Number(x.duration_hours), 0),
    })
    setPendingMissed(rows.filter((x: any) => x.status === 'planned' && x.session_date < t).length)
  }

  useEffect(() => { loadAll() /* eslint-disable-next-line */ }, [])

  // What-if slider: recalculates readiness live, saves nothing
  useEffect(() => {
    if (!simulating) return
    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc('get_readiness', { p_today: today(), p_daily_hours: hours })
      setReadiness((data as Readiness[]) ?? [])
    }, 250)
    return () => clearTimeout(timer)
  }, [hours, simulating])

  async function fellBehind() {
    setBusy(true); setMsg('')
    try {
      const r = await replan(today())
      setMsg(`Plan updated: ${r.missed} missed sessions rescheduled, ${r.created} new sessions created`)
      await loadAll()
    } catch (e: any) { setMsg('Error: ' + e.message) }
    setBusy(false)
  }

  const totalTopics = progress.reduce((n, p) => n + Number(p.total_topics), 0)
  const doneTopics = progress.reduce((n, p) => n + Number(p.done_topics), 0)
  const overall = totalTopics ? Math.round((100 * doneTopics) / totalTopics) : 0
  const donut = [{ name: 'Done', value: overall }, { name: 'Left', value: 100 - overall }]
  const atRisk = readiness.filter(r => r.status === 'at_risk')

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-blue-700">Dashboard</h1>
          <p className="text-sm text-gray-500">{email}</p>
        </div>
        <button onClick={fellBehind} disabled={busy}
          className="rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-50">
          {busy ? 'Replanning...' : 'I fell behind'}
        </button>
      </div>

      {msg && <p className="rounded bg-blue-50 p-2 text-blue-800">{msg}</p>}
      {pendingMissed > 0 && (
        <p className="rounded bg-orange-50 p-2 text-orange-800">
          You have {pendingMissed} unfinished past session(s). Click "I fell behind" to reschedule them.
        </p>
      )}

      {/* Top row */}
      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Overall progress</h2>
          <div className="relative h-40">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={donut} dataKey="value" innerRadius={50} outerRadius={70} startAngle={90} endAngle={-270}>
                  <Cell fill="#2563eb" /><Cell fill="#e5e7eb" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-blue-700">{overall}%</div>
          </div>
          <p className="text-center text-sm text-gray-500">{doneTopics} of {totalTopics} topics done</p>
        </section>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 font-semibold">Today</h2>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded bg-blue-50 p-2"><div className="text-xl font-bold text-blue-700">{todayStats.planned}</div><div className="text-xs">Planned</div></div>
            <div className="rounded bg-green-50 p-2"><div className="text-xl font-bold text-green-700">{todayStats.done}</div><div className="text-xs">Done</div></div>
            <div className="rounded bg-red-50 p-2"><div className="text-xl font-bold text-red-700">{todayStats.missed}</div><div className="text-xs">Missed</div></div>
            <div className="rounded bg-gray-50 p-2"><div className="text-xl font-bold">{todayStats.hours}h</div><div className="text-xs">Studied</div></div>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 font-semibold">Upcoming exams &amp; deadlines</h2>
          <ul className="space-y-1 text-sm">
            {progress.map(p => (
              <li key={p.subject_id} className="flex justify-between">
                <span><span style={{ color: p.color }}>●</span> {p.name} exam</span>
                <span className="text-gray-500">{daysTo(p.exam_date)} days</span>
              </li>
            ))}
            {assignments.map(a => (
              <li key={a.id} className="flex justify-between">
                <span>📝 {a.title}</span>
                <span className="text-gray-500">{daysTo(a.due_date)} days</span>
              </li>
            ))}
            {progress.length === 0 && assignments.length === 0 && <li className="text-gray-500">Nothing upcoming yet.</li>}
          </ul>
        </section>
      </div>

      {/* Readiness + slider */}
      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">Exam readiness</h2>
        <div className="my-3 rounded-lg bg-blue-50 p-3">
          <label className="block text-sm font-medium">
            What if I study <span className="text-lg font-bold text-blue-700">{hours}</span> hours a day?
          </label>
          <input type="range" min={1} max={8} step={1} value={hours} className="w-full"
            onChange={e => { setSimulating(true); setHours(Number(e.target.value)) }} />
          <p className="text-xs text-gray-500">Moving the slider only simulates. Nothing is saved.</p>
        </div>

        {readiness.length === 0 && <p className="text-gray-500">Add subjects and topics to see readiness.</p>}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {readiness.map(r => (
            <div key={r.subject_id} className="rounded-lg border p-3" style={{ borderLeft: `6px solid ${r.color}` }}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{r.subject_name}</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-bold text-white ${r.status === 'on_track' ? 'bg-green-600' : 'bg-red-600'}`}>
                  {r.status === 'on_track' ? 'On track' : 'At risk'}
                </span>
              </div>
              <p className="my-1 text-3xl font-bold">{Math.round(Number(r.projected_pct))}%</p>
              <p className="text-xs text-gray-600">{r.explanation}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Needs more time */}
      {atRisk.length > 0 && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="font-semibold text-red-700">Needs more time</h2>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {atRisk.map(r => {
              const extra = Math.max(0, (Number(r.hours_needed) - Number(r.hours_available)) / Math.max(r.days_left, 1))
              return (
                <li key={r.subject_id}>
                  {r.subject_name}: add about {(Math.ceil(extra * 10) / 10).toFixed(1)} extra hour(s) a day
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Subject progress */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 font-semibold">Subject progress</h2>
          {progress.map(p => (
            <div key={p.subject_id} className="mb-3">
              <div className="flex justify-between text-sm">
                <span>{p.name}</span><span>{Number(p.progress_pct)}% ({p.done_topics}/{p.total_topics})</span>
              </div>
              <div className="h-3 rounded bg-gray-200">
                <div className="h-3 rounded" style={{ width: `${Number(p.progress_pct)}%`, background: p.color }} />
              </div>
            </div>
          ))}
          {progress.length === 0 && <p className="text-gray-500">No subjects yet.</p>}
        </section>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 font-semibold">Progress per subject</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={progress.map(p => ({ name: p.name, progress: Number(p.progress_pct) }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" /><YAxis domain={[0, 100]} /><Tooltip />
                <Bar dataKey="progress" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </main>
  )
}