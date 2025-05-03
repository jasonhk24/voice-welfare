'use client';

import { useEffect, useState } from 'react';

export default function SpeechRecognizer() {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');

  const startRecognition = () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      alert('이 브라우저는 음성 인식을 지원하지 않습니다.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = true;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('');
      setText(result);
    };

    recognition.start();
  };

  return (
    <div className="text-center mt-10">
      <button
        onClick={startRecognition}
        className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
      >
        {listening ? '🎤 듣는 중...' : '🎙️ 마이크로 말하기'}
      </button>
      <p className="mt-6 text-xl min-h-[4rem] border-t pt-4">{text || '여기에 인식된 텍스트가 표시됩니다.'}</p>
    </div>
  );
}
