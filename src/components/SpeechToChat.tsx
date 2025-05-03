/* src/components/SpeechToChat.tsx */
'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useRef } from 'react';

export default function SpeechToChat() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [promptText, setPromptText] = useState('');
  const [replies, setReplies] = useState<string[]>([]);
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
    setReplies([]);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText }),
      });
      const { answer, error } = await res.json();
      if (error) {
        setReplies([`Error: ${error}`]);
      } else {
        // 답변을 문장 단위로 쪼개서 배열에 저장
        const parts = answer
            .split(/(?:\r?\n)+/)                // 빈 줄 기준
            .map((s: string) => s.trim())       // s가 string임을 명시
            .filter((s: string) => Boolean(s)); // s가 string임을 명시
        setReplies(parts);
      }
    } catch {
      setReplies(['네트워크 오류가 발생했습니다.']);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8 text-lg">
      {/* 헤더 */}
      <h1 className="text-3xl font-bold text-center">🎤 복지 정책 챗봇</h1>

      {/* 컨트롤 */}
      <div className="flex space-x-4">
        <button
          onClick={toggleListen}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg text-xl hover:bg-blue-700 transition"
        >
          {listening ? '■ 중지' : '🎙️ 말하기'}
        </button>
        <button
          onClick={() => { setTranscript(''); setPromptText(''); }}
          className="py-3 px-6 bg-gray-300 rounded-lg text-xl hover:bg-gray-400 transition"
        >
          지우기
        </button>
      </div>

      {/* 인식 텍스트 & 수정 */}
      <div>
        <label className="block text-xl font-medium mb-2">📝 인식된 텍스트</label>
        <textarea
          className="w-full border-2 border-gray-300 p-3 rounded-lg text-lg focus:outline-none focus:border-blue-500"
          rows={2}
          value={transcript}
          onChange={e => { setTranscript(e.target.value); setPromptText(e.target.value); }}
        />
      </div>

      {/* 예시 문장 */}
      <div>
        <label className="block text-xl font-medium mb-2">💡 예시 문장</label>
        <div className="flex space-x-4">
          {examples.map(ex => (
            <button
              key={ex}
              onClick={() => { setPromptText(ex); setTranscript(ex); }}
              className="text-blue-600 underline"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* 최종 질문 입력 */}
      <div>
        <label className="block text-xl font-medium mb-2">🔧 최종 질문</label>
        <input
          type="text"
          className="w-full border-2 border-gray-300 p-3 rounded-lg text-lg focus:outline-none focus:border-blue-500"
          value={promptText}
          onChange={e => setPromptText(e.target.value)}
          placeholder="질문을 입력하거나 수정하세요."
        />
      </div>

      {/* 전송 버튼 */}
      <button
        onClick={sendToGPT}
        disabled={loading}
        className="w-full py-3 bg-green-600 text-white rounded-lg text-xl disabled:opacity-50 hover:bg-green-700 transition"
      >
        {loading ? '생성 중…' : '✅ 확인 & 전송'}
      </button>

      {/* GPT 답변 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {replies.map((r, i) => (
          <div
            key={i}
            className="p-6 bg-white shadow-md rounded-lg border-l-4 border-blue-500"
          >
            <p>{r}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
