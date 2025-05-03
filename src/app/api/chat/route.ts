// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: Request) {
  const { prompt } = await request.json();

  // 1) 시스템 프롬프트 정의 (룰)
  const systemPrompt = `
    당신은 대한민국 복지 정책 전문 챗봇입니다.
    - 정책 검색 결과만 말하세요.
    - 불확실한 정보는 "죄송합니다, 확인 중입니다."라고 답변하세요.
    - 사용자 눈높이에 맞춰 간단명료하게 설명하세요.
  `.trim();

  // 2) 메시지 배열에 system 역할과 user 역할을 모두 넣습니다.
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: prompt         },
  ];

  // 3) 호출 옵션에 temperature, top_p, model 등 원하는 값을 넣을 수 있습니다.
  const body = {
    model:       'gpt-4o-mini',    // 필요하면 'gpt-3.5-turbo' 등으로 바꿔도 OK
    messages,
    max_tokens:  500,
    temperature: 0.0,              // 0.0 ~ 2.0 : 낮출수록 결정론적
    top_p:       1.0,              // nucleus sampling
    frequency_penalty: 0.0,
    presence_penalty:  0.6,
  };

  const res = await fetch(
    'https://api.openai.com/v1/chat/completions',
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const json   = await res.json();
  const answer = json.choices?.[0]?.message?.content ?? '';

  return NextResponse.json({ answer });
}
