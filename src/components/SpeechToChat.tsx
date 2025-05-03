/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';

export default function SpeechToChat() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);

  const handleListen = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('이 브라우저는 음성 인식을 지원하지 않습니다.');
      return;
    }

    const recog = new SR();
    recog.lang = 'ko-KR';
    recog.interimResults = true;

    recog.onstart = () => setListening(true);
    recog.onend = () => {
      setListening(false);
      if (transcript) sendToGPT(transcript);
    };

    recog.onresult = (event: any) => {
      const text = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('');
      setTranscript(text);
    };

    recog.start();
  };

  const sendToGPT = async (text: string) => {
    setLoading(true);
    setReply('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      });
      const { answer, error } = await res.json();
      if (error) setReply('Error: ' + error);
      else setReply(answer);
    } catch (e) {
      setReply('네트워크 오류가 발생했습니다.');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <button
        onClick={handleListen}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
      >
        {listening ? '🎤 듣는 중...' : '🎙️ 말하기 & GPT에 전달'}
      </button>

      <div>
        <h2 className="font-medium">📝 인식된 텍스트</h2>
        <p className="p-4 mt-2 bg-gray-50 rounded">{transcript || '여기에 자동으로 텍스트가 표시됩니다.'}</p>
      </div>

      <div>
        <h2 className="font-medium">💡 GPT 답변</h2>
        <p className="p-4 mt-2 bg-gray-100 rounded min-h-[4rem]">
          {loading ? '생성 중…' : reply || 'GPT의 답변이 여기에 표시됩니다.'}
        </p>
      </div>
    </div>
  );
}
