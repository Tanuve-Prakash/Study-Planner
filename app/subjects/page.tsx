'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import GeneratePlanButton from '@/components/GeneratePlanButton'

type Topic = {
  id: string
  subject_id: string
  name: string
  difficulty: number
  estimated_hours: number
  status: 'pending' | 'in_progress' | 'done'
}
type Subject = { id: string; name: string; exam_date: string; color: string }
type TForm = { name: string; difficulty: number; hours: number }

const emptyForm: TForm = { name: '', difficulty: 3, hours: 1 }

export default function SubjectsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [examDate, setExamDate] = useState('')
  const [color, setColor] = useState('#3b82f6')
  const [tForm, setTForm] = useState<Record<string, TForm>>({})

  async function load() {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) {
      router.push('/login')
      return
    }
    setUserId(auth.user.id)
    const { data: s } = await supabase.from('subjects').select('*').order('exam_date')
    const { data: t } = await supabase.from('topics').select('*').order('created_at')
    setSubjects((s as Subject[]) ?? [])
    setTopics((t as Topic[]) ?? [])
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function addSubject(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!userId) return setError('You are not logged in. Please log in again.')
    const { error } = await supabase
      .from('subjects')
      .insert({ user_id: userId, name, exam_date: examDate, color })
    if (error) return setError('Failed to add subject: ' + error.message)
    setName('')
    setExamDate('')
    load()
  }

  async function deleteSubject(id: string) {
    setError('')
    const { error } = await supabase.from('subjects').delete().eq('id', id)
    if (error) setError('Failed to delete subject: ' + error.message)
    load()
  }

  async function addTopic(subjectId: string) {
    setError('')
    if (!userId) return setError('You are not logged in. Please log in again.')

    const f = tForm[subjectId] ?? emptyForm
    const topicName = f.name.trim()
    const hours = Number(f.hours)
    const difficulty = Number(f.difficulty)

    if (!topicName) return setError('Please type a topic name.')
    if (!hours || hours <= 0) return setError('Hours must be a number greater than 0.')

    const { error } = await supabase.from('topics').insert({
      user_id: userId,
      subject_id: subjectId,
      name: topicName,
      difficulty,
      estimated_hours: hours,
      status: 'pending',
    })

    if (error) return setError('Failed to add topic: ' + error.message)

    setTForm({ ...tForm, [subjectId]: { ...emptyForm } })
    load()
  }

  async function setStatus(id: string, status: string) {
    setError('')
    const { error } = await supabase
      .from('topics')
      .update({ status, completed_at: status === 'done' ? new Date().toISOString() : null })
      .eq('id', id)
    if (error) setError('Failed to update status: ' + error.message)
    load()
  }

  async function deleteTopic(id: string) {
    setError('')
    const { error } = await supabase.from('topics').delete().eq('id', id)
    if (error) setError('Failed to delete topic: ' + error.message)
    load()
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-700">Subjects &amp; Topics</h1>
        <GeneratePlanButton />
      </div>

      {error && <p className="mb-3 rounded bg-red-100 p-2 text-red-700">{error}</p>}

      <form onSubmit={addSubject} className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div>
          <label className="block text-sm">Subject name</label>
          <input className="rounded border p-2" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm">Exam date</label>
          <input type="date" className="rounded border p-2" value={examDate} onChange={e => setExamDate(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm">Color</label>
          <input type="color" className="h-10 w-14 rounded border" value={color} onChange={e => setColor(e.target.value)} />
        </div>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          Add subject
        </button>
      </form>

      {subjects.length === 0 && <p className="text-gray-500">No subjects yet. Add your first one above.</p>}

      {subjects.map(s => {
        const f = tForm[s.id] ?? emptyForm
        const list = topics.filter(t => t.subject_id === s.id)
        return (
          <section key={s.id} className="mb-5 rounded-lg border p-4" style={{ borderLeft: `6px solid ${s.color}` }}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{s.name}</h2>
                <p className="text-sm text-gray-500">Exam: {s.exam_date}</p>
              </div>
              <button type="button" onClick={() => deleteSubject(s.id)} className="text-sm text-red-600 hover:underline">
                Delete subject
              </button>
            </div>

            {list.length === 0 && <p className="mb-2 text-sm text-gray-500">No topics yet.</p>}
            <ul className="mb-3 space-y-2">
              {list.map(t => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-gray-50 p-2">
                  <span>
                    {t.name}{' '}
                    <span className="text-xs text-gray-500">
                      (difficulty {t.difficulty}/5, {t.estimated_hours}h)
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <select
                      className="rounded border p-1 text-sm"
                      value={t.status}
                      onChange={e => setStatus(t.id, e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Done</option>
                    </select>
                    <button type="button" onClick={() => deleteTopic(t.id)} className="text-sm text-red-600 hover:underline">
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-end gap-2">
              <input
                className="rounded border p-2"
                placeholder="Topic name"
                value={f.name}
                onChange={e => setTForm({ ...tForm, [s.id]: { ...f, name: e.target.value } })}
              />
              <select
                className="rounded border p-2"
                value={f.difficulty}
                onChange={e => setTForm({ ...tForm, [s.id]: { ...f, difficulty: Number(e.target.value) } })}
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>Difficulty {n}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={10}
                step={1}
                className="w-20 rounded border p-2"
                value={f.hours}
                onChange={e => setTForm({ ...tForm, [s.id]: { ...f, hours: Number(e.target.value) } })}
              />
              <span className="text-sm text-gray-500">hours</span>
              <button
                type="button"
                onClick={() => addTopic(s.id)}
                className="rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
              >
                Add topic
              </button>
            </div>
          </section>
        )
      })}
    </main>
  )
}