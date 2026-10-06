'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Subject = { id: string; name: string }
type Assignment = {
  id: string
  title: string
  due_date: string
  estimated_hours: number
  status: 'pending' | 'done'
  subject_id: string | null
}

export default function AssignmentsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [items, setItems] = useState<Assignment[]>([])
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [hours, setHours] = useState(2)

  async function load() {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return router.push('/login')
    setUserId(auth.user.id)
    const { data: s } = await supabase.from('subjects').select('id,name').order('name')
    const { data: a } = await supabase.from('assignments').select('*').order('due_date')
    setSubjects((s as Subject[]) ?? [])
    setItems((a as Assignment[]) ?? [])
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!userId) return setError('Please log in again.')
    if (!title.trim() || !dueDate) return setError('Title and due date are required.')
    const { error } = await supabase.from('assignments').insert({
      user_id: userId,
      title: title.trim(),
      subject_id: subjectId || null,
      due_date: dueDate,
      estimated_hours: Number(hours) || 1,
      status: 'pending',
    })
    if (error) return setError('Failed to add assignment: ' + error.message)
    setTitle(''); setDueDate(''); setHours(2)
    load()
  }

  async function toggle(a: Assignment) {
    const done = a.status !== 'done'
    const { error } = await supabase
      .from('assignments')
      .update({ status: done ? 'done' : 'pending', completed_at: done ? new Date().toISOString() : null })
      .eq('id', a.id)
    if (error) setError(error.message)
    load()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('assignments').delete().eq('id', id)
    if (error) setError(error.message)
    load()
  }

  const today = new Date().toLocaleDateString('en-CA')
  const subjName = (id: string | null) => subjects.find(s => s.id === id)?.name ?? 'General'

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-blue-700">Assignments</h1>
      {error && <p className="mb-3 rounded bg-red-100 p-2 text-red-700">{error}</p>}

      <form onSubmit={add} className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div>
          <label className="block text-sm">Title</label>
          <input className="rounded border p-2" value={title} onChange={e => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm">Subject</label>
          <select className="rounded border p-2" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
            <option value="">General</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm">Due date</label>
          <input type="date" className="rounded border p-2" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm">Hours</label>
          <input type="number" min={1} max={20} className="w-20 rounded border p-2" value={hours}
            onChange={e => setHours(Number(e.target.value))} />
        </div>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          Add assignment
        </button>
      </form>

      {items.length === 0 && <p className="text-gray-500">No assignments yet.</p>}
      <ul className="space-y-2">
        {items.map(a => {
          const overdue = a.status === 'pending' && a.due_date < today
          return (
            <li key={a.id} className="flex items-center justify-between rounded-lg border p-3">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={a.status === 'done'} onChange={() => toggle(a)} />
                <span className={a.status === 'done' ? 'text-gray-400 line-through' : ''}>
                  {a.title}
                  <span className="ml-2 text-xs text-gray-500">
                    {subjName(a.subject_id)} · due {a.due_date} · {a.estimated_hours}h
                  </span>
                </span>
              </label>
              <span className="flex items-center gap-3">
                {overdue && <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">Overdue</span>}
                {a.status === 'done' && <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Done</span>}
                <button type="button" onClick={() => remove(a.id)} className="text-sm text-red-600 hover:underline">
                  Delete
                </button>
              </span>
            </li>
          )
        })}
      </ul>
    </main>
  )
}