'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Navbar() {
  const router = useRouter()
  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }
  const link = 'rounded px-3 py-1 hover:bg-blue-100'
  return (
    <nav className="flex flex-wrap items-center gap-2 border-b bg-white px-4 py-2 text-blue-700">
      <span className="mr-3 font-bold">StudyPlanner</span>
      <Link className={link} href="/dashboard">Dashboard</Link>
      <Link className={link} href="/subjects">Subjects</Link>
      <Link className={link} href="/calendar">Calendar</Link>
      <Link className={link} href="/settings">Settings</Link>
      <Link className={link} href="/assignments">Assignments</Link>
      <button onClick={logout} className="ml-auto rounded px-3 py-1 text-red-600 hover:bg-red-50">Logout</button>
    </nav>
  )
}