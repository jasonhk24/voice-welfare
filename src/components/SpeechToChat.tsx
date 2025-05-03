/* src/components/SpeechToChat.tsx */
'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useRef } from 'react';

export default function SpeechToChat() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [promptText, setPromptText] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const recogRef = useRef<any>(null);

  const toggleListen = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return alert('음성 인식을 지원하지 않습니다.');

    if (listening) {
      recogRef.current.stop();
    } else {
      const recog = new SR();
      recogRef.current = recog;
      recog.lang = 'ko-KR';
      recog.interimResults = true;

      recog.onstart = () => setListening(true);
      recog.onend = () => setListening(false);

      recog.onresult = (event: any) => {
        const text = Array.from(event.results)
          .map((r: any) => r[0].transcript)
          .join('');
        setTranscript(text);
        setPromptText(text);
      };

      recog.start();
    }
  };

  const examples = [
    '장애인 지원 정책을 알려줘.',
    '노인 대상 복지 혜택 추천해줘.',
    '청년 취업 지원 제도 알려줘.',
  ];

  const sendToGPT = async () => {
    if (!promptText) return alert('먼저 질문을 입력하거나 말해주세요.');
    setLoading(true);
    setReply('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText }),
      });
      const { answer, error } = await res.json();
      if (error) setReply('Error: ' + error);
      else setReply(answer);
    } catch {
      setReply('네트워크 오류가 발생했습니다.');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="flex space-x-3">
        <button
          onClick={toggleListen}
          className="flex-1 py-2 bg-blue-600 text-white rounded-lg"
        >
          {listening ? '■ 중지' : '🎙️ 말하기'}
        </button>
        <button
          onClick={() => { setTranscript(''); setPromptText(''); }}
          className="py-2 px-4 bg-gray-300 rounded-lg"
        >
          지우기
        </button>
      </div>

      <div>
        <h2 className="font-medium">📝 인식된 텍스트</h2>
        <textarea
          className="w-full border p-2 rounded-lg mt-1"
          rows={2}
          value={transcript}
          onChange={e => { setTranscript(e.target.value); setPromptText(e.target.value); }}
        />
      </div>

      <div>
        <h2 className="font-medium">💡 예시 문장</h2>
        <ul className="list-disc list-inside text-blue-600 space-y-1 mt-1">
          {examples.map(ex => (
            <li key={ex}>
              <button
                onClick={() => { setPromptText(ex); setTranscript(ex); }}
                className="underline"
              >
                {ex}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="font-medium">🔧 최종 질문 (입력/수정 가능)</h2>
        <input
          type="text"
          className="w-full border p-2 rounded-lg mt-1"
          value={promptText}
          onChange={e => setPromptText(e.target.value)}
          placeholder="여기에 질문을 입력하거나 수정하세요."
        />
      </div>

      <button
        onClick={sendToGPT}
        disabled={loading}
        className="w-full py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
      >
        {loading ? '생성 중…' : '✅ 확인 & 전송'}
      </button>

      <div>
        <h2 className="font-medium">🗨️ GPT 답변</h2>
        <p className="p-4 bg-gray-50 rounded-lg min-h-[4rem] mt-1">
          {reply || '여기에 GPT의 답변이 표시됩니다.'}
        </p>
      </div>
    </div>
  );
}
