// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: Request) {
  const { prompt } = await request.json();

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const json = await res.json();
  const answer = json.choices?.[0]?.message?.content ?? '';

  return NextResponse.json({ answer });
}
