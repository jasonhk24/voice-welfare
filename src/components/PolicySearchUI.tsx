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
  // 음성/텍스트 상태
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [promptText, setPromptText] = useState('');
  const recogRef = useRef<any>(null);

  // 정책 카드 상태
  const [policies, setPolicies] = useState<Policy[]>([]);

  // 폰트 크기 상태
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');
  const sizeMap = { sm: 'text-sm', base: 'text-base', lg: 'text-lg' } as const;

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

  // 더미 검색
  const doSearch = () => {
    if (!promptText.trim()) return alert('질문을 입력하거나 말해주세요.');
    setPolicies([
      { id: '1', title: '장애인 연금 지원', description: '장애인에게 매달 일정 금액을 지원하여 생활 안정에 도움을 줍니다.', url: 'https://www.bokjiro.go.kr/disability-pension' },
      { id: '2', title: '장애인 고용 지원', description: '직업 훈련 및 고용 알선, 인센티브 제공으로 일자리 찾기를 지원합니다.', url: 'https://www.bokjiro.go.kr/disability-employment' },
      { id: '3', title: '장애인 복지 서비스', description: '의료·상담·재활 서비스 등을 제공하여 삶의 질을 향상시킵니다.', url: 'https://www.bokjiro.go.kr/disability-services' },
    ]);
  };

  const examples = [
    '장애인 지원 정책을 알려줘.',
    '노인 대상 복지 혜택 추천해줘.',
    '청년 취업 지원 제도 알려줘.',
  ];

  return (
    <div className={`relative flex w-full min-h-screen bg-gray-50 ${sizeMap[fontSize]}`}>
      {/* 폰트 크기 조절 컨트롤 (우측 상단) */}
      <div className="absolute top-4 right-4 flex items-center space-x-2 z-20">
        <span className="font-medium">폰트 크기:</span>
        {(['sm','base','lg'] as const).map(sz => (
          <button
            key={sz}
            aria-pressed={fontSize === sz}
            onClick={() => setFontSize(sz)}
            className={`px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              fontSize === sz ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
            }`}
          >
            {sz === 'sm' ? '작게' : sz === 'base' ? '보통' : '크게'}
          </button>
        ))}
        <button
          aria-label="폰트 초기화"
          onClick={() => setFontSize('base')}
          className="px-2 py-1 rounded bg-gray-300 hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          초기화
        </button>
      </div>

      {/* LEFT PANEL (입력) */}
      <motion.div
        className="flex-shrink-0 p-8 bg-white shadow-lg"
        initial={{ width: '100%' }}
        animate={{ width: policies.length ? '40%' : '100%' }}
        transition={{ duration: 0.4 }}
      >
        <div className="max-w-md mx-auto space-y-6">
          <h1 className="text-3xl font-bold">말로 만나는 복지 도우미</h1>

          <div className="flex space-x-3">
            <button
              onClick={toggleListen}
              aria-label={listening ? '음성 인식 중지' : '음성 인식 시작'}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {listening ? '■ 중지' : '🎙️ 말하기'}
            </button>
            <button
              onClick={() => { setTranscript(''); setPromptText(''); }}
              aria-label="입력 내용 지우기"
              className="py-3 px-4 bg-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              지우기
            </button>
          </div>

          <div>
            <label htmlFor="transcript" className="block mb-1 font-medium">📝 인식된 텍스트</label>
            <textarea
              id="transcript"
              rows={3}
              className="w-full border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={transcript}
              onChange={e => { setTranscript(e.target.value); setPromptText(e.target.value); }}
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">💡 예시 문장</label>
            <ul className="list-disc list-inside space-y-1">
              {examples.map(ex => (
                <li key={ex}>
                  <button
                    onClick={() => { setPromptText(ex); setTranscript(ex); }}
                    className="text-blue-600 underline focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ex}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label htmlFor="prompt" className="block mb-1 font-medium">🔧 최종 질문</label>
            <input
              id="prompt"
              type="text"
              className="w-full border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
              placeholder="질문을 입력하거나 수정하세요."
            />
          </div>

          <button
            onClick={doSearch}
            aria-label="검색 실행 및 정책 카드 표시"
            className="w-full py-3 bg-green-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            ✅ 확인 & 전송
          </button>
        </div>
      </motion.div>

      {/* RIGHT PANEL (카드) */}
      <motion.div
        className="flex-1 p-8 overflow-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: policies.length ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      >
        {policies.length > 0 && (
          <div className="max-w-7xl mx-auto space-y-4">
            {/* 뒤로가기 전용 헤더 */}
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">검색 결과</h2>
              <button
                onClick={handleBack}
                aria-label="뒤로가기"
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                ← 뒤로가기
              </button>
            </div>

            {/* 카드 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {policies.map(p => (
                <div
                  key={p.id}
                  className="bg-white rounded-xl shadow-md focus-within:ring-2 focus-within:ring-blue-500"
                  tabIndex={0}
                  role="region"
                  aria-labelledby={`policy-${p.id}-title`}
                >
                  <div className="px-6 py-4 bg-blue-50 border-b">
                    <h3 id={`policy-${p.id}-title`} className="text-xl font-bold">{p.title}</h3>
                  </div>
                  <div className="p-6">{p.description}</div>
                  <div className="px-6 py-4 border-t text-right">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      자세히 보기 →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
