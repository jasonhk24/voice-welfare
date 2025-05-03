'use client';

import { useState } from 'react';

// window에 webkitSpeechRecognition이 있는 걸 알려주는 선언
declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export default function SpeechRecognizer() {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');

  const startRecognition = () => {
    // SpeechRecognition 생성자를 window에서 꺼냅니다
    const RecognitionClass =
      window.webkitSpeechRecognition ||
      window.SpeechRecognition;

    if (!RecognitionClass) {
      alert('이 브라우저는 음성 인식을 지원하지 않습니다.');
      return;
    }

    const recognition = new RecognitionClass();
    recognition.lang = 'ko-KR';
    recognition.interimResults = true;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);

    recognition.onresult = (event) => {
      // SpeechRecognitionEvent이 자동 유추되므로 타입 지정 불필요
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
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
