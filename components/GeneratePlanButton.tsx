'use client'
import { useState } from 'react'
import { replan } from '@/lib/scheduler'


export default function GeneratePlanButton({ label = 'Generate plan' }: { label?: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const today = new Date().toLocaleDateString('en-CA')
      const r = await replan(today)
      alert(`Plan updated. Missed: ${r.missed}, new sessions: ${r.created}`)
    } catch (e: any) {
      alert('Error: ' + (e?.message ?? 'something went wrong'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? 'Planning...' : label}
    </button>
  )
}