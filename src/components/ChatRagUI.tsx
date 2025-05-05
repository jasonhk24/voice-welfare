// src/components/ChatRagUI.tsx
const [fontLevel, setFontLevel] = useState(5)        // 1~10 단계
const fontScale = fontLevel / 5                      // 5단계=1배, 10단계=2배, 1단계=0.2배

/* eslint-disable @typescript-eslint/no-unused-expressions */
// Web Speech API 타입 선언
type SpeechRecognition = {
  lang: string
  interimResults: boolean
  onstart: () => void
  onresult: (e: SpeechRecognitionEvent) => void
  onend: () => void
  start(): void
  stop(): void
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
}

type SpeechRecognitionResultList = SpeechRecognitionResult[]

interface SpeechRecognitionResult {
  0: { transcript: string; confidence: number }
  isFinal: boolean
}

declare global {
  interface Window {
    SpeechRecognition: { new(): SpeechRecognition }
    webkitSpeechRecognition: { new(): SpeechRecognition }
  }
}
// —————————————————————————————————————————

'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatRagUI() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [promptText, setPromptText] = useState('');
  const recogRef = useRef<SpeechRecognition | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);

  // 예시 응답 데이터 (더미 RAG 결과)
  const dummyResponses = [
    '🎯 장애인 연금 지원: 장애인에게 매달 일정 금액을 지원하여 생활 안정에 도움을 줍니다.\n자세히 보기: https://www.bokjiro.go.kr/disability-pension',
    '🎯 장애인 고용 지원: 직업 훈련 및 고용 알선, 인센티브 제공으로 일자리 찾기를 지원합니다.\nhttps://www.bokjiro.go.kr/disability-employment',
    '🎯 장애인 복지 서비스: 의료·상담·재활 서비스 등을 제공하여 삶의 질을 향상시킵니다.\nhttps://www.bokjiro.go.kr/disability-services',
  ];

  // 음성 인식 토글
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
      recog.onend   = () => setListening(false);
      recog.onresult = (e: SpeechRecognitionEvent) => {
        const results = Array.from(e.results as SpeechRecognitionResultList);
        const text = results
          .map((r: SpeechRecognitionResult) => r[0].transcript)
          .join('');
        setTranscript(text);
        setPromptText(text);
      };
      recog.start();
    }
  };

  // 사용자 → 챗봇 메시지 전송
  const handleSend = () => {
    if (!promptText.trim()) return alert('먼저 질문을 말하거나 입력해주세요.');
    const userMsg: Message = {
      id: messages.length,
      role: 'user',
      content: promptText.trim(),
    };
    // 챗 창에 사용자 메시지 추가
    setMessages(prev => [...prev, userMsg]);

    // 더미 RAG 응답 추가
    const botMsgs = dummyResponses.map((text, i) => ({
      id: messages.length + 1 + i,
      role: 'assistant' as const,
      content: text,
    }));
    setTimeout(() => {
      setMessages(prev => [...prev, ...botMsgs]);
    }, 500); // 0.5초 후에 나타나도록 약간 딜레이

    // 입력 초기화
    setTranscript('');
    setPromptText('');
  };

  const examples = [
    '장애인 지원 정책을 알려줘.',
    '노인 대상 복지 혜택 추천해줘.',
    '청년 취업 지원 제도 알려줘.',
  ];

  return (
    <div
  style={{ fontSize: `${fontScale}rem` }}
  className="relative flex w-full h-screen bg-gradient-to-br from-yellow-100 to-yellow-50 overflow-hidden"
>
  {/* 폰트 크기 조절 버튼 */}
  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10">
    <button
      onClick={() => setFontLevel(l => Math.max(1, l - 1))}
      className="px-3 py-1 bg-white rounded-lg shadow"
    >
      A-
    </button>
    <button
      onClick={() => setFontLevel(5)}
      className="px-3 py-1 bg-white rounded-lg shadow"
    >
      Reset
    </button>
    <button
      onClick={() => setFontLevel(l => Math.min(10, l + 1)))}
      className="px-3 py-1 bg-white rounded-lg shadow"
    >
      A+
    </button>
  </div>

      {/* LEFT PANEL */}
      <motion.div
        className="flex-shrink-0 p-6 bg-white rounded-3xl shadow-lg w-full lg:w-1/3 xl:w-1/4 flex flex-col justify-between ml-4"
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">🎙️ 말로 만나는 복지 도우미</h1>

          <div className="flex space-x-2">
            <button
              onClick={toggleListen}
              aria-label={listening ? '음성 인식 중지' : '음성 인식 시작'}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            >
              {listening ? '■ 중지' : '🎤 말하기'}
            </button>
            <button
              onClick={() => { setTranscript(''); setPromptText(''); }}
              aria-label="입력 초기화"
              className="py-2 px-4 bg-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 transition"
            >지우기</button>
          </div>

          <div>
            <label htmlFor="transcript" className="block mb-1 font-medium">📝 인식된 텍스트</label>
            <textarea
              id="transcript"
              rows={3}
              className="w-full border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              value={transcript}
              onChange={e => { setTranscript(e.target.value); setPromptText(e.target.value); }}
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">💡 예시 문장</label>
            <ul className="list-disc list-inside space-y-1 text-blue-600">
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
            <label htmlFor="prompt" className="block mb-1 font-medium">🔧 최종 질문</label>
            <input
              id="prompt"
              type="text"
              className="w-full border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              placeholder="질문을 입력하거나 수정하세요."
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={handleSend}
          className="mt-6 py-3 bg-emerald-500 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
        >
          ✅ 확인 & 전송
        </button>
      </motion.div>

      {/* RIGHT PANEL (채팅창) */}
      <motion.div
        className="flex-1 p-6 overflow-y-auto space-y-4 bg-white/80 rounded-3xl mr-4"
        initial={{ x: 50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {messages.length === 0 ? (
          <p className="text-center text-gray-500 mt-20">여기에 대화가 표시됩니다.</p>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`
                max-w-2xl p-4 rounded-lg
                ${msg.role === 'user'
                  ? 'ml-auto bg-blue-100 text-right'
                  : 'mr-auto bg-gray-100 text-left'}
              `}
              tabIndex={0}
              role="article"
              aria-label={msg.role === 'user' ? '사용자 메시지' : '시스템 메시지'}
            >
              <pre className="whitespace-pre-wrap">{msg.content}</pre>
            </div>
          ))
        )}
      </motion.div>
    </div>
  );
}
