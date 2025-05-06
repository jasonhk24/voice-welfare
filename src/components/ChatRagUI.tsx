// src/components/ChatRagUI.tsx
'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';

type SpeechRecognition = { /* … */ };
interface SpeechRecognitionEvent { /* … */ }
type SpeechRecognitionResultList = /* … */;
interface SpeechRecognitionResult { /* … */ }

declare global {
  interface Window {
    SpeechRecognition: { new (): SpeechRecognition };
    webkitSpeechRecognition: { new (): SpeechRecognition };
  }
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  isPlaceholder?: boolean;
}

export default function ChatRagUI() {
  // 테마·접근성
  const [theme, setTheme] = useState<'light'|'dark'|'highContrast'>('light');
  const [captions, setCaptions] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(1);

  // 첫 방문 안내 모달 단계
  const [modalStep, setModalStep] = useState(1);

  // 음성 입력·히스토리
  const [listening, setListening] = useState(false);
  const [speechHistory, setSpeechHistory] = useState<string[]>([]);
  const [transcript, setTranscript] = useState('');
  const recogRef = useRef<SpeechRecognition|null>(null);

  // 채팅
  const [messages, setMessages] = useState<Message[]>([]);

  const dummyResponses = [ /* … */ ];

  // 접근성 툴바
  const Toolbar = () => (
    <div className="fixed top-0 left-0 w-full bg-white/80 p-2 flex justify-end space-x-4 z-20">
      <button onClick={() => setTheme(t => t==='light'?'highContrast':'light')}>
        {theme==='highContrast' ? '기본 모드' : '고대비 모드'}
      </button>
      <button onClick={() => setTheme(t => t==='dark'?'light':'dark')}>
        {theme==='dark' ? '라이트 모드' : '야간 모드'}
      </button>
      <button onClick={() => setCaptions(c => !c)}>
        {captions ? '자막 끄기' : '자막 켜기'}
      </button>
      <label>
        TTS 속도
        <input type="range" min={0.5} max={2} step={0.1}
          value={ttsSpeed}
          onChange={e => setTtsSpeed(+e.target.value)} />
      </label>
    </div>
  );

  // 단계별 안내 모달
  const StepModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30">
      <div className="bg-white p-6 rounded-lg max-w-sm text-center">
        {modalStep===1 && <p>1. 음성으로 질문하기</p>}
        {modalStep===2 && <p>2. 답변 확인하기</p>}
        {modalStep===3 && <p>3. 바로 신청하기</p>}
        <button onClick={() => setModalStep(s => s+1)}>다음</button>
      </div>
    </div>
  );

  // 파형 애니메이션
  const Waveform = () => (
    <div className="w-full h-12 bg-gray-200 flex items-end overflow-hidden space-x-1 my-2">
      {[...Array(30)].map((_,i)=>(
        <div key={i} className="w-1 bg-blue-400 animate-pulse" style={{height: `${Math.random()*100}%}}`}}/>
      ))}
    </div>
  );

  // 음성 히스토리 타임라인
  const HistoryTimeline = () => (
    <ul className="text-sm text-gray-600 space-y-1">
      {speechHistory.slice(-3).map((t,i)=> <li key={i}>• {t}</li>)}
    </ul>
  );

  // 정책 카드 (예시)
  const PolicyCard = ({ title }: { title: string }) => (
    <div className="relative bg-white p-4 rounded-lg shadow-md hover:shadow-xl transform hover:scale-105 transition m-2">
      <span className="absolute top-2 left-2 bg-yellow-300 px-1 rounded text-xs">🔖 당신께 딱 맞는 지원</span>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm">간단한 설명이 들어갑니다.</p>
    </div>
  );

  // 로딩 애니메이션 (아이콘 회전)
  const LoadingAnimation = () => (
    <div className="flex flex-col items-center">
      <p className="mb-2">조건에 맞는 복지 검색중…</p>
      <div className="w-8 h-8">
        <PolicyCard title="🔄" />
      </div>
    </div>
  );

  // 피드백 레이어
  const FeedbackLayer = () => (
    <div className="flex justify-center space-x-4 mt-2">
      <button>👍</button>
      <button>👎</button>
    </div>
  );

  // 음성 토글 로직 (간단히 history 추가)
  const toggleListen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert('지원 안 됨');
    if (listening) { recogRef.current?.stop(); }
    else {
      const recog = new SR() as SpeechRecognition;
      recogRef.current = recog;
      recog.lang = 'ko-KR'; recog.interimResults = true;
      recog.onresult = e => {
        const text = Array.from(e.results as any).map(r=>r[0].transcript).join('');
        setTranscript(text);
      };
      recog.onend = () => {
        setListening(false);
        setSpeechHistory(h=>[...h, transcript]);
      };
      recog.onstart = () => setListening(true);
      recog.start();
    }
  };

  // 채팅 전송 (placeholder 생략)
  const handleSend = () => { /* …기존 로직 유지… */ };

  return (
    <div className={`${theme==='highContrast'?'contrast-200':''
      } ${theme==='dark'?'bg-gray-900 text-white':''}`}>
      <Toolbar />
      {modalStep <= 3 && <StepModal />}

      <main className="pt-16 flex">
        {/* LEFT */}
        <section className="w-1/3 p-4">
          <h1 className="text-center text-3xl font-bold">🎙️ 복지 도우미</h1>
          <button onClick={toggleListen}>{listening?'■ 중지':'🎤 말하기'}</button>
          <Waveform />
          <HistoryTimeline />
          <textarea
            className="w-full h-20 mt-2 p-2 border rounded"
            value={transcript}
            onChange={e=>setTranscript(e.target.value)}
          />
          <button onClick={handleSend}>전송</button>
        </section>

        {/* RIGHT */}
        <section className="w-2/3 p-4 space-y-4">
          {messages.length===0
            ? <p>여기에 대화가 표시됩니다.</p>
            : messages.map(msg => (
                <div key={msg.id}
                  className={`p-4 rounded-lg ${
                    msg.role==='user'
                      ? 'bg-gray-100 self-start'
                      : 'bg-blue-100 self-end text-left'
                  } font-semibold`}
                >
                  {msg.content}
                  {msg.isPlaceholder && <LoadingAnimation />}
                  {!msg.isPlaceholder && <FeedbackLayer />}
                </div>
              ))}
        </section>
      </main>

      {/* 정책 카드 섹션 */}
      <div className="flex flex-wrap justify-center mt-8">
        {['장애인 연금','고용 지원','복지 서비스'].map(title => (
          <PolicyCard key={title} title={title} />
        ))}
      </div>
    </div>
  );
}
