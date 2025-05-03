// src/components/PolicySearchUI.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface Policy {
  id: string;
  title: string;
  description: string;
  url: string;
}

export default function PolicySearchUI() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [promptText, setPromptText] = useState('');
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');
  const recogRef = useRef<any>(null);

  // 음성 토글
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
      recog.onresult = (e: any) => {
        const text = Array.from(e.results).map((r: any) => r[0].transcript).join('');
        setTranscript(text);
        setPromptText(text);
      };
      recog.start();
    }
  };

  // 뒤로가기: 검색 초기화
  const handleBack = () => {
    setPolicies([]);
    setTranscript('');
    setPromptText('');
  };

  // 예시 문장
  const examples = [
    '장애인 지원 정책을 알려줘.',
    '노인 대상 복지 혜택 추천해줘.',
    '청년 취업 지원 제도 알려줘.',
  ];

  // 검색 (더미 데이터)
  const doSearch = () => {
    if (!promptText) return alert('질문을 입력하거나 말해주세요.');
    setPolicies([
      {
        id: '1',
        title: '장애인 연금 지원',
        description: '장애인에게 매달 일정 금액을 지원하여 생활 안정에 도움을 줍니다.',
        url: 'https://www.bokjiro.go.kr/disability-pension',
      },
      {
        id: '2',
        title: '장애인 고용 지원',
        description: '직업 훈련 및 고용 알선, 인센티브 제공으로 일자리 찾기를 지원합니다.',
        url: 'https://www.bokjiro.go.kr/disability-employment',
      },
      {
        id: '3',
        title: '장애인 복지 서비스',
        description: '의료·상담·재활 서비스 등을 제공하여 삶의 질을 향상시킵니다.',
        url: 'https://www.bokjiro.go.kr/disability-services',
      },
    ]);
  };

  // Tailwind 크기 맵
  const sizeMap = { sm: 'text-sm', base: 'text-base', lg: 'text-lg' } as const;

  return (
    <div className={`flex w-full h-full min-h-screen bg-gray-50 ${sizeMap[fontSize]}`}>
      {/* 폰트 크기 조절 */}
      <div className="absolute top-4 right-4 flex items-center space-x-2">
        <span className="font-medium">폰트 크기:</span>
        {(['sm','base','lg'] as const).map(sz => (
          <button
            key={sz}
            onClick={() => setFontSize(sz)}
            className={`px-2 py-1 rounded ${
              fontSize === sz ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            {sz === 'sm' ? '작게' : sz === 'base' ? '보통' : '크게'}
          </button>
        ))}
      </div>

      {/* LEFT PANEL */}
      <motion.div
        className="p-8 bg-white shadow-lg z-10"
        initial={{ width: '100%' }}
        animate={{ width: policies.length ? '40%' : '100%' }}
        transition={{ duration: 0.5 }}
      >
        {/* 뒤로가기 버튼 */}
        {policies.length > 0 && (
          <button
            onClick={handleBack}
            className="mb-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            ← 뒤로가기
          </button>
        )}

        <h1 className="text-3xl font-bold mb-6">말로 만나는 복지 도우미</h1>

        <div className="space-y-4">
          <div className="flex space-x-4">
            <button
              onClick={toggleListen}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {listening ? '■ 중지' : '🎙️ 말하기'}
            </button>
            <button
              onClick={() => { setTranscript(''); setPromptText(''); }}
              className="py-3 px-4 bg-gray-300 rounded-lg hover:bg-gray-400"
            >
              지우기
            </button>
          </div>

          <div>
            <label className="block mb-1 font-medium">📝 인식된 텍스트</label>
            <textarea
              className="w-full border p-2 rounded-lg resize-none"
              rows={2}
              value={transcript}
              onChange={e => { setTranscript(e.target.value); setPromptText(e.target.value); }}
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">💡 예시 문장</label>
            <div className="flex space-x-3">
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

          <div>
            <label className="block mb-1 font-medium">🔧 최종 질문</label>
            <input
              type="text"
              className="w-full border p-2 rounded-lg"
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
              placeholder="질문을 입력하거나 수정하세요."
            />
          </div>

          <button
            onClick={doSearch}
            className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            ✅ 확인 & 전송
          </button>
        </div>
      </motion.div>

      {/* RIGHT PANEL (cards) */}
      <motion.div
        className="p-8 overflow-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: policies.length ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {policies.map((p) => (
            <div key={p.id} className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b bg-blue-50">
                <h2 className="text-xl font-bold">{p.title}</h2>
              </div>
              <div className="p-6">{p.description}</div>
              <div className="px-6 py-4 border-t text-right">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-medium"
                >
                  자세히 보기 →
                </a>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
