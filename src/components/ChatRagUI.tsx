// src/components/ChatRagUI.tsx
'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';

//
// Web Speech API 타입 선언
//
type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  onstart: () => void;
  onresult: (e: SpeechRecognitionEvent) => void;
  onend: () => void;
  start(): void;
  stop(): void;
};

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

type SpeechRecognitionResultList = SpeechRecognitionResult[];

interface SpeechRecognitionResult {
  0: { transcript: string; confidence: number };
  isFinal: boolean;
}

declare global {
  interface Window {
    SpeechRecognition: { new(): SpeechRecognition };
    webkitSpeechRecognition: { new(): SpeechRecognition };
  }
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatRagUI() {
  const [fontLevel, setFontLevel] = useState(5);            // 1~10 단계
  const fontScale = fontLevel / 5;                          // 폰트 스케일 계산
  const [loading, setLoading] = useState(false);

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [promptText, setPromptText] = useState('');
  const recogRef = useRef<SpeechRecognition | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);

  const dummyResponses = [
    '🎯 장애인 연금 지원: 장애인에게 매달 일정 금액을 지원하여 생활 안정에 도움을 줍니다.\n자세히 보기: https://www.bokjiro.go.kr/disability-pension',
    '🎯 장애인 고용 지원: 직업 훈련 및 고용 알선, 인센티브 제공으로 일자리 찾기를 지원합니다.\nhttps://www.bokjiro.go.kr/disability-employment',
    '🎯 장애인 복지 서비스: 의료·상담·재활 서비스 등을 제공하여 삶의 질을 향상시킵니다.\nhttps://www.bokjiro.go.kr/disability-services',
  ];

  const toggleListen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert('음성 인식을 지원하지 않습니다.');

    if (listening) {
      recogRef.current?.stop();
    } else {
      const recog = new SR() as SpeechRecognition;
      recogRef.current = recog;
      recog.lang = 'ko-KR';
      recog.interimResults = true;
      recog.onstart = () => setListening(true);
      recog.onend = () => setListening(false);
      recog.onresult = (e: SpeechRecognitionEvent) => {
        const results = Array.from(e.results as SpeechRecognitionResultList);
        const text = results.map(r => r[0].transcript).join('');
        setTranscript(text);
        setPromptText(text);
      };
      recog.start();
    }
  };

  const handleSend = () => {
    if (!promptText.trim()) return alert('먼저 질문을 입력하거나 말해주세요.');
    const userMsg: Message = {
      id: messages.length,
      role: 'user',
      content: promptText.trim(),
    };
    setMessages(prev => [...prev, userMsg]);

    const botMsgs = dummyResponses.map((text, i) => ({
      id: messages.length + 1 + i,
      role: 'assistant' as const,
      content: text,
    }));

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setMessages(prev => [...prev, ...botMsgs]);
    }, 3000);

    setTranscript('');
    setPromptText('');
  };

  const examples = [
    '장애인 지원 정책을 알려줘.',
    '노인 대상 복지 혜택 추천해줘.',
    '청년 취업 지원 제도 알려줘.',
  ];

  return (
    <main
      role="main"
      style={{ fontSize: `${fontScale}rem` }}
      className="relative flex w-full h-screen gap-8 py-8 px-4 bg-gradient-to-br from-yellow-100 to-yellow-50 overflow-auto"
    >
      {/* 폰트 크기 조절 */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10">
        <button
          onClick={() => setFontLevel(l => Math.max(1, l - 1))}
          className="px-4 py-1 min-h-[48px] bg-white rounded-lg shadow focus:outline-none focus:ring-2"
          aria-label="글자 작게"
        >
          작게
        </button>
        <button
          onClick={() => setFontLevel(5)}
          className="px-4 py-1 min-h-[48px] bg-white rounded-lg shadow focus:outline-none focus:ring-2"
          aria-label="글자 원래대로"
        >
          원래대로
        </button>
        <button
          onClick={() => setFontLevel(l => Math.min(10, l + 1))}
          className="px-4 py-1 min-h-[48px] bg-white rounded-lg shadow focus:outline-none focus:ring-2"
          aria-label="글자 크게"
        >
          크게
        </button>
      </div>

      {/* LEFT PANEL */}
      <motion.div
        role="region"
        aria-label="입력 패널"
        className="flex-shrink-0 p-6 bg-white rounded-3xl shadow-lg w-full lg:w-1/3 xl:w-1/4 flex flex-col justify-between ml-4"
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold">🎙️ 말로 만나는 복지 도우미</h1>
        <div className="space-y-4">
          <div className="flex space-x-2">
            <button
              onClick={toggleListen}
              aria-label={listening ? '음성 인식 중지' : '음성 인식 시작'}
              className="flex-1 min-h-[48px] py-2 bg-blue-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {listening ? '■ 중지' : '🎤 말하기'}
            </button>
            <button
              onClick={() => { setTranscript(''); setPromptText(''); }}
              className="min-h-[48px] py-2 px-4 bg-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              지우기
            </button>
          </div>
          <div>
            <label htmlFor="transcript" className="font-medium">📝 인식된 텍스트</label>
            <textarea
              id="transcript"
              rows={3}
              className="w-full min-h-[48px] border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={transcript}
              onChange={e => { setTranscript(e.target.value); setPromptText(e.target.value); }}
            />
          </div>
          <div>
            <label className="font-medium">💡 예시 문장</label>
            <ul className="list-disc list-inside text-blue-600 space-y-1">
              {examples.map(ex => (
                <li key={ex}>
                  <button
                    onClick={() => { setPromptText(ex); setTranscript(ex); }}
                    className="underline focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {ex}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <label htmlFor="prompt" className="font-medium">🔧 최종 질문</label>
            <input
              id="prompt"
              type="text"
              className="w-full min-h-[48px] border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="질문을 입력하거나 수정하세요."
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={handleSend}
          className="mt-4 min-h-[48px] py-3 bg-emerald-500 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          ✅ 확인 & 전송
        </button>
      </motion.div>

      {/* RIGHT PANEL */}
      <motion.section
        role="region"
        aria-label="응답 패널"
        aria-live="polite"
        className="flex-1 p-6 overflow-y-auto space-y-4 bg-white rounded-3xl mr-4"
        initial={{ x: 50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-2xl font-semibold mb-4">조건에 맞는 복지 검색중...</p>
            <div className="w-8 h-8 border-4 border-t-4 border-gray-300 rounded-full animate-spin" role="status" aria-label="로딩 중" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-gray-500 mt-20">여기에 대화가 표시됩니다.</p>
        ) : (
          messages.map(msg => (
            <article
              key={msg.id}
              className={`max-w-2xl p-4 rounded-lg ${msg.role === 'user' ? 'ml-auto bg-blue-100 text-right' : 'mr-auto bg-gray-100 text-left'}`}
              tabIndex={0}
            >
              <pre className="whitespace-pre-wrap">{msg.content}</pre>
            </article>
          ))
        )}
      </motion.section>
    </main>
  );
}
