// src/components/ChatRagUI.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

//
// Web Speech API 타입 선언 (기존과 동일)
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
    SpeechRecognition: { new (): SpeechRecognition };
    webkitSpeechRecognition: { new (): SpeechRecognition };
  }
}

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  originalContent?: string; // "원문 보기"를 위한 필드
  isPlaceholder?: boolean;
  isExpanded?: boolean; // "더 보기" 기능을 위한 필드
  category?: "연금" | "고용" | "복지" | "일반"; // 로딩 애니메이션 및 스타일링용
}

type Theme = "light" | "dark" | "high-contrast";

export default function ChatRagUI() {
  // 폰트 스케일
  const [fontLevel, setFontLevel] = useState(5);
  const fontScale = fontLevel / 5;

  // 테마 상태
  const [theme, setTheme] = useState<Theme>("light");

  // 음성 인식 상태
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [promptText, setPromptText] = useState("");
  const recogRef = useRef<SpeechRecognition | null>(null);

  // 메시지 리스트
  const [messages, setMessages] = useState<Message[]>([]);
  // 메시지 내용 보기 모드 (쉬운 설명/원문) - 메시지 ID별로 관리
  const [viewModes, setViewModes] = useState<Record<number, "simplified" | "original">>({});
  // 메시지 확장 상태 - 메시지 ID별로 관리
  const [expandedStates, setExpandedStates] = useState<Record<number, boolean>>({});


  // 탐색 히스토리
  const [history, setHistory] = useState<string[]>([]);

  // 더미 응답 (카테고리 및 원문 예시 추가)
  const dummyResponses: Omit<Message, "id" | "role">[] = [
    {
      content: "장애인 연금은 경제적으로 어려움을 겪는 장애인의 생활 안정을 돕기 위한 제도입니다. 소득과 재산 기준을 충족하는 경우 매월 일정 금액을 지원받을 수 있어요.",
      originalContent: "장애인연금법에 따라, 장애로 인하여 생활이 어려운 중증장애인의 생활안정 지원을 목적으로 하며, 근로능력의 상실 또는 현저한 감소로 인하여 줄어든 소득을 보전하기 위하여 매월 일정액의 연금을 지급하는 사회보장제도이다.",
      category: "연금",
    },
    {
      content: "장애인 고용 지원은 장애인이 직업을 갖고 사회의 일원으로 참여할 수 있도록 돕습니다. 직업 훈련, 취업 알선, 그리고 사업주에게는 고용 장려금 등을 지원해요.",
      originalContent: "장애인고용촉진 및 직업재활법에 의거하여, 국가는 장애인의 고용촉진 및 직업재활을 위하여 필요한 지원시책을 종합적으로 추진해야 한다. 주요 사업으로는 직업능력개발훈련, 취업알선, 고용장려금 지급 등이 있다.",
      category: "고용",
    },
    {
      content: "장애인 복지 서비스에는 다양한 지원이 포함됩니다. 예를 들어, 활동 지원 서비스를 통해 일상생활이나 사회활동에 도움을 받을 수 있고, 의료비 지원이나 보조기기 지원 등도 받을 수 있어요.",
      originalContent: "장애인복지법은 장애인의 인간다운 삶과 권리보장을 위한 국가와 지방자치단체 등의 책임을 명백히 하고, 장애발생 예방과 장애인의 의료·교육·직업재활·생활환경개선 등에 관한 사업을 정하여 장애인복지대책을 종합적으로 추진함을 목적으로 한다. 활동지원급여, 의료비 지원, 보조기기 교부 등이 이에 해당된다.",
      category: "복지",
    },
  ];

  // 테마 적용 및 localStorage 연동
  useEffect(() => {
    const savedTheme = localStorage.getItem("chatTheme") as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark", "high-contrast");
    document.documentElement.classList.add(theme);
    localStorage.setItem("chatTheme", theme);
  }, [theme]);

  // 토글 음성 인식
  const toggleListen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("음성 인식을 지원하지 않습니다.");
      return;
    }
    if (listening) {
      recogRef.current?.stop();
    } else {
      const recog = new SR() as SpeechRecognition;
      recogRef.current = recog;
      recog.lang = "ko-KR";
      recog.interimResults = true; // 중간 결과도 받음
      recog.onstart = () => setListening(true);
      recog.onend = () => {
        setListening(false);
        // 음성 인식이 끝나면 최종 텍스트로 promptText 업데이트
        if (transcript.trim()) {
            setPromptText(transcript.trim());
        }
      };
      recog.onresult = (e: SpeechRecognitionEvent) => {
        const results = Array.from(e.results as SpeechRecognitionResultList);
        const finalText = results
            .filter(r => r.isFinal)
            .map(r => r[0].transcript)
            .join('');
        const interimText = results
            .filter(r => !r.isFinal)
            .map(r => r[0].transcript)
            .join('');

        if(finalText){
            setTranscript(prev => prev + finalText); // 인식된 최종 텍스트를 기존 transcript에 추가 (띄어쓰기 등 고려)
            setPromptText(prev => prev + finalText);
        } else {
            setTranscript(prevTranscript => { // 마지막 interim transcript만 반영하도록 수정
                 const lastWordBoundary = prevTranscript.lastIndexOf(' ');
                 const base = lastWordBoundary === -1 ? '' : prevTranscript.substring(0, lastWordBoundary + 1);
                 return base + interimText;
            });
        }
      };
      recog.start();
    }
  };

  // 질문 전송 핸들러
  const handleSend = useCallback(() => {
    const trimmedPrompt = promptText.trim();
    if (!trimmedPrompt) {
      alert("먼저 질문을 입력하거나 말해주세요.");
      return;
    }

    // 사용자 메시지
    const userMsg: Message = {
      id: Date.now(),
      role: "user",
      content: trimmedPrompt,
      category: "일반",
    };
    // placeholder 메시지
    const placeholderMsg: Message = {
      id: Date.now() + 1,
      role: "assistant",
      content: "생각중입니다...",
      isPlaceholder: true,
      category: "일반", // 또는 사용자의 질문 카테고리 추론
    };

    setMessages((prev) => [...prev, userMsg, placeholderMsg]);

    // 히스토리 업데이트
    setHistory((prevHistory) => {
      const newHistory = [trimmedPrompt, ...prevHistory.filter(h => h !== trimmedPrompt)];
      return newHistory.slice(0, 3); // 최근 3개만 유지
    });

    setTranscript("");
    setPromptText("");

    // 2초 후 실제 응답으로 대체
    setTimeout(() => {
      // 랜덤하게 더미 응답 중 하나 선택
      const randomDummy = dummyResponses[Math.floor(Math.random() * dummyResponses.length)];
      const botMsg: Message = {
        id: Date.now() + 2,
        role: "assistant",
        content: randomDummy.content,
        originalContent: randomDummy.originalContent,
        category: randomDummy.category,
        isExpanded: false, // 기본은 축소된 상태
      };
      setViewModes(prev => ({...prev, [botMsg.id]: "simplified"})); // 기본은 쉬운 설명
      setExpandedStates(prev => ({...prev, [botMsg.id]: (botMsg.content.length <= 100) })); // 내용 짧으면 기본 확장

      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.isPlaceholder);
        return [...filtered, botMsg];
      });
    }, 2000);
  }, [promptText, dummyResponses]);

  const examples = [
    "장애인 연금 지원 알려줘.",
    "노인 대상 복지 혜택은?",
    "청년 취업 지원 제도 뭐 있어?",
  ];

  // 메시지 보기 모드 토글
  const toggleViewMode = (id: number) => {
    setViewModes(prev => ({
      ...prev,
      [id]: prev[id] === "simplified" ? "original" : "simplified"
    }));
  };

  // 메시지 확장/축소 토글
  const toggleExpand = (id: number) => {
    setExpandedStates(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getButtonClass = (isActive: boolean = false) =>
    `px-4 py-2 min-h-[52px] rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-colors duration-150 ease-in-out
     text-gray-800 dark:text-gray-200
     ${isActive ?
        'bg-blue-500 dark:bg-blue-700 text-white ring-blue-400 dark:ring-blue-500' :
        'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 ring-gray-300 dark:ring-gray-500'
     }
     hc:border-2 hc:border-black hc:text-black hc:bg-white`; // 고대비 스타일

  const getInputClass = () =>
    `w-full min-h-[52px] border p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500
     bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600
     hc:border-2 hc:border-black hc:text-black hc:bg-white`;


  return (
    <main
      role="main"
      style={{ fontSize: `${fontScale}rem` }}
      className="relative flex flex-col lg:flex-row w-full min-h-screen h-full gap-4 lg:gap-8 py-4 px-2 md:px-4 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 hc:bg-white hc:text-black transition-colors duration-150 ease-in-out overflow-y-auto"
    >
      {/* 상단 컨트롤 바 */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20 p-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-md">
        {/* 폰트 조절 */}
        <button onClick={() => setFontLevel((l) => Math.max(1, l - 1))} className={getButtonClass()} aria-label="글자 작게"> 작게 </button>
        <button onClick={() => setFontLevel(5)} className={getButtonClass()} aria-label="글자 원래대로"> 보통 </button>
        <button onClick={() => setFontLevel((l) => Math.min(10, l + 1))} className={getButtonClass()} aria-label="글자 크게"> 크게 </button>
        {/* 테마 조절 */}
        <button onClick={() => setTheme("light")} className={getButtonClass(theme === "light")} aria-label="라이트 모드">☀️</button>
        <button onClick={() => setTheme("dark")} className={getButtonClass(theme === "dark")} aria-label="다크 모드">🌙</button>
        <button onClick={() => setTheme("high-contrast")} className={getButtonClass(theme === "high-contrast")} aria-label="고대비 모드">👁️</button>
      </div>

      {/* LEFT PANEL */}
      <motion.div
        role="region"
        aria-label="입력 패널"
        className="flex-shrink-0 p-4 md:p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full lg:w-1/3 xl:w-1/4 flex flex-col justify-between mt-20 lg:mt-4 hc:border-2 hc:border-black"
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div>
            <h1 className="w-full text-center text-3xl font-bold mb-4 text-gray-800 dark:text-gray-200 hc:text-black">
            🎙️ 말로 만나는 복지 도우미
            </h1>
            <div className="space-y-4">
            <div className="flex space-x-2">
                <button
                onClick={toggleListen}
                aria-label={listening ? "음성 인식 중지" : "음성 인식 시작"}
                className={`flex-1 min-h-[52px] py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-colors duration-150 ease-in-out font-semibold
                            ${listening ?
                                'bg-red-500 hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-800 text-white ring-red-400 dark:ring-red-500 hc:bg-red-500 hc:text-white hc:border-black' :
                                'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white ring-blue-400 dark:ring-blue-500 hc:bg-blue-600 hc:text-white hc:border-black'
                            }`}
                >
                {listening ? "■ 중지" : "🎤 말하기"}
                </button>
                <button
                onClick={() => {
                    setTranscript("");
                    setPromptText("");
                }}
                className={getButtonClass() + ` font-semibold`}
                aria-label="입력 내용 지우기"
                >
                지우기
                </button>
            </div>
            <div>
                <label htmlFor="transcript" className="font-medium text-gray-700 dark:text-gray-300 hc:text-black">
                📝 인식된 텍스트 (실시간)
                </label>
                <textarea
                id="transcript"
                rows={3}
                className={getInputClass()}
                value={transcript}
                onChange={(e) => {
                    setTranscript(e.target.value);
                    setPromptText(e.target.value); // 타이핑 시 최종 질문에도 반영
                }}
                placeholder="음성 인식이 여기에 표시됩니다..."
                />
            </div>
            <div>
                <label htmlFor="prompt" className="font-medium text-gray-700 dark:text-gray-300 hc:text-black">
                🔧 최종 질문
                </label>
                <input
                id="prompt"
                type="text"
                className={getInputClass()}
                placeholder="질문을 입력하거나 수정하세요."
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                />
            </div>
            <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 hc:text-black">💡 예시 문장</label>
                <ul className="space-y-1 mt-1">
                {examples.map((ex) => (
                    <li key={ex}>
                    <button
                        onClick={() => {
                        setPromptText(ex);
                        setTranscript(ex);
                        }}
                        className="w-full text-left p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 text-blue-600 dark:text-blue-400 hc:text-blue-600 hc:hover:bg-gray-200 underline"
                    >
                        {ex}
                    </button>
                    </li>
                ))}
                </ul>
            </div>
            {history.length > 0 && (
                <div>
                    <label className="font-medium text-gray-700 dark:text-gray-300 hc:text-black">⏱️ 최근 질문</label>
                    <ul className="space-y-1 mt-1">
                    {history.map((h, i) => (
                        <li key={i}>
                        <button
                            onClick={() => {
                            setPromptText(h);
                            setTranscript(h);
                            }}
                            className="w-full text-left p-2 text-sm rounded-md bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 text-gray-600 dark:text-gray-300 hc:bg-gray-100 hc:text-gray-700"
                            title={h}
                        >
                            - {h.length > 30 ? `${h.substring(0, 27)}...` : h}
                        </button>
                        </li>
                    ))}
                    </ul>
                </div>
            )}
            </div>
        </div>
        <button
          onClick={handleSend}
          className="mt-6 min-h-[52px] w-full py-3 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:focus:ring-emerald-500 font-semibold transition-colors duration-150 ease-in-out hc:bg-emerald-500 hc:text-white hc:border-black"
        >
          ✅ 확인 & 전송
        </button>
      </motion.div>

      {/* RIGHT PANEL */}
      <motion.section
        role="region"
        aria-label="응답 패널"
        className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4 bg-white dark:bg-gray-800 rounded-2xl shadow-xl mt-4 lg:mt-20 hc:border-2 hc:border-black"
        initial={{ x: 50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        aria-live="polite" // 새로운 메시지 알림
      >
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.article
              key={msg.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className={`max-w-full lg:max-w-3xl p-4 rounded-xl shadow ${
                msg.role === "user"
                  ? "mr-auto bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hc:bg-gray-100 hc:text-black hc:border hc:border-gray-400"
                  : "ml-auto bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hc:bg-blue-100 hc:text-black hc:border hc:border-blue-400"
              } font-medium`}
              tabIndex={0}
              role="article"
              aria-label={msg.role === "user" ? `사용자 메시지: ${msg.content.substring(0,30)}` : `챗봇 답변: ${msg.content.substring(0,30)}`}
            >
              {msg.isPlaceholder ? (
                <div className="flex items-center">
                  <span className="animate-spin mr-2 text-lg">
                    {msg.category === "연금" ? "💰" : msg.category === "고용" ? "💼" : msg.category === "복지" ? "🤝" : "💬"}
                  </span>
                  <span className="animate-pulse">{msg.content}</span>
                </div>
              ) : (
                <>
                  <pre className="whitespace-pre-wrap text-left">
                    {msg.role === 'assistant' && viewModes[msg.id] === 'original' && msg.originalContent
                      ? msg.originalContent
                      : msg.content}
                  </pre>
                  {msg.role === 'assistant' && (
                    <>
                    {msg.originalContent && ( /* 쉬운말/원문 토글은 원문이 있을 때만 */
                        <button
                            onClick={() => toggleViewMode(msg.id)}
                            className="text-xs mt-2 px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 hc:bg-gray-300 hc:text-black"
                        >
                            {viewModes[msg.id] === 'simplified' ? '원문 보기' : '쉬운 설명 보기'}
                        </button>
                    )}
                    {/* 더 보기/간략히 버튼은 내용이 길 때만 (예: 100자 초과) */}
                    {(msg.content.length > 100 || (msg.originalContent && viewModes[msg.id] === 'original' && msg.originalContent.length > 100)) && (
                        <button
                            onClick={() => toggleExpand(msg.id)}
                            className="text-xs mt-2 ml-2 px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 hc:bg-gray-300 hc:text-black"
                        >
                            {expandedStates[msg.id] ? '간략히 보기' : '더 보기'}
                        </button>
                    )}
                    </>
                  )}
                  {/* 더 보기/간략히 기능에 따라 실제 내용 표시 조절 */}
                  {/* 이 부분은 pre 태그 내용을 조건부로 잘라서 보여주거나, CSS로 max-height를 조절하는 방식으로 구현해야 합니다. */}
                  {/* 간단하게는 expandedStates[msg.id]가 false일 때 content를 잘라서 보여줄 수 있습니다. */}
                  {/* 예를 들어, <pre> 내부에 {expandedStates[msg.id] ? currentContent : currentContent.substring(0,100) + "..."} </pre> */}
                  {/* 하지만 pre 태그의 특성상 줄바꿈 등이 유지되려면 좀 더 복잡한 처리가 필요할 수 있습니다. */}
                  {/* 여기서는 버튼만 두고, 실제 내용 자르기는 CSS의 line-clamp나 JS를 통한 문자열 조작으로 구현 가능합니다. */}
                </>
              )}
            </motion.article>
          ))}
        </AnimatePresence>
        {messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-10 hc:text-gray-600">
            <p className="text-xl mb-2">👋 안녕하세요!</p>
            <p>음성 또는 텍스트로 복지 정책에 대해 질문해주세요.</p>
            <p className="mt-4">예시 문장을 클릭하거나, 직접 궁금한 점을 말씀해보세요.</p>
          </div>
        )}
      </motion.section>
    </main>
  );
}

// globals.css 또는 해당 컴포넌트의 <style jsx global> 등에 추가할 CSS
/*
:root {
  --bg-light: #f9fafb; --text-light: #1f2937;
  --bg-dark: #111827; --text-dark: #f3f4f6;
  --bg-hc: white; --text-hc: black; --border-hc: black;

  --btn-bg-light: white; --btn-text-light: #374151;
  --btn-bg-dark: #374151; --btn-text-dark: #d1d5db;
  --btn-bg-hc: white; --btn-text-hc: black; --btn-border-hc: black;
}

.light { background-color: var(--bg-light); color: var(--text-light); }
.dark { background-color: var(--bg-dark); color: var(--text-dark); }
.high-contrast { background-color: var(--bg-hc); color: var(--text-hc); }

.high-contrast button, .high-contrast input, .high-contrast textarea, .high-contrast div, .high-contrast section, .high-contrast article {
  border: 1px solid var(--border-hc, black) !important; // Tailwind CSS hc: 접두사로 대체
  background-color: var(--bg-hc, white) !important;
  color: var(--text-hc, black) !important;
}
.high-contrast .text-blue-600 { color: blue !important; } // 고대비 시 특정 색상 강제

*/

// Tailwind CSS 설정 파일 (tailwind.config.js)에 hc variant 추가
/*
module.exports = {
  // ...
  plugins: [
    function({ addVariant }) {
      addVariant('hc', '.high-contrast &') // 또는 'html.high-contrast &'
    }
  ],
}
*/