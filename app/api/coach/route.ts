import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { summary } = await req.json()
  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 })

  const prompt = `You are a friendly study coach for a student. Using this data, give:
1. A one-line summary of how the week is going.
2. The 3 most important things to do next (short bullets, mention subject names).
3. One encouraging tip.
Keep it under 120 words. Plain text only, no markdown symbols.

DATA:
${JSON.stringify(summary)}`

  const res = await fetch(
     `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  )
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return NextResponse.json({ error: data?.error?.message ?? 'No reply from AI' }, { status: 500 })
  return NextResponse.json({ text })
}