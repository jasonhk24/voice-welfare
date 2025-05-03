'use client';

import { useState } from 'react';

export default function SpeechRecognizer() {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');

  const startRecognition = () => {
    // 👇 여기서만 any를 쓰도록 eslint 무시
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const RecognitionClass = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

    if (!RecognitionClass) {
      alert('이 브라우저는 음성 인식을 지원하지 않습니다.');
      return;
    }

    const recognition = new RecognitionClass();
    recognition.lang = 'ko-KR';
    recognition.interimResults = true;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('');
      setText(transcript);
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
      <p className="mt-6 text-xl min-h-[4rem] border-t pt-4">
        {text || '여기에 인식된 텍스트가 표시됩니다.'}
      </p>
    </div>
  );
}
