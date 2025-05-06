// src/components/ChatRagUI.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ... (기존 타입 선언들 SpeechRecognition, Message, Theme 등은 동일하게 유지)
type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean; // 연속적인 결과 처리를 위해 추가 (명령어 인식에 유용할 수 있음)
  onstart: () => void;
  onresult: (e: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (e: SpeechRecognitionErrorEvent) => void; // onerror 타입 명시
  onnomatch: () => void; // onnomatch 추가
  start(): void;
  stop(): void;
};

// SpeechRecognitionErrorEvent 타입 추가
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number; // 현재 결과의 인덱스
}

type SpeechRecognitionResultList = {
  [index: number]: SpeechRecognitionResult;
  length: number;
  item: (index: number) => SpeechRecognitionResult;
};

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
  item: (index: number) => SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
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
  originalContent?: string;
  isPlaceholder?: boolean;
  isExpanded?: boolean;
  category?: "연금" | "고용" | "복지" | "일반";
}

type Theme = "light" | "dark" | "high-contrast";


export default function ChatRagUI() {
  const [fontLevel, setFontLevel] = useState(5);
  const fontScale = fontLevel / 5;
  const [theme, setTheme] = useState<Theme>("light");
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState(""); // 최종 확정된 음성인식 결과
  const [promptText, setPromptText] = useState("");
  const recogRef = useRef<SpeechRecognition | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [viewModes, setViewModes] = useState<Record<number, "simplified" | "original">>({});
  const [expandedStates, setExpandedStates] = useState<Record<number, boolean>>({});
  const [history, setHistory] = useState<string[]>([]);

  // 음성 인식 관련 상태 메시지 및 오류 메시지
  const [speechStatus, setSpeechStatus] = useState<string>("");
  const [micError, setMicError] = useState<string>("");

  // ... (dummyResponses, useEffects for theme, examples 등 기존 로직 유지)
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

  useEffect(() => {
    const savedTheme = localStorage.getItem("chatTheme") as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark", "high-contrast");
    root.classList.add(theme);
    localStorage.setItem("chatTheme", theme);
  }, [theme]);


  const toggleListen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setMicError("음성 인식을 지원하지 않는 브라우저입니다.");
      alert("음성 인식을 지원하지 않는 브라우저입니다.");
      return;
    }

    if (listening && recogRef.current) {
      recogRef.current.stop();
      // setListening(false); // onend에서 처리
      // setSpeechStatus(""); // onend에서 처리
    } else {
      const recog = new SR() as SpeechRecognition;
      recogRef.current = recog;
      recog.lang = "ko-KR";
      recog.interimResults = true; // 중간 결과 받음
      // recog.continuous = true; // 연속 인식 (필요에 따라 사용, 명령어 처리에 유리할 수 있음)

      recog.onstart = () => {
        setListening(true);
        setSpeechStatus("듣고 있어요... 말씀해주세요.");
        setMicError("");
        setTranscript(""); // 이전 인식 내용 초기화
        setFinalTranscript(""); // 최종 확정된 내용도 초기화
      };

      recog.onend = () => {
        setListening(false);
        setSpeechStatus("");
        // 최종 인식된 텍스트를 promptText로 설정
        if (finalTranscript.trim()) {
          setPromptText(finalTranscript.trim());
        } else if (transcript.trim() && !finalTranscript.trim()) {
            // continuous가 false일 때, 마지막 interim이 final처럼 동작하는 경우 대비
            setPromptText(transcript.trim());
        }
        // recogRef.current = null; // 필요시 해제
      };

      recog.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = "";
        let currentFinalTranscript = finalTranscript; // 기존 final transcript 유지

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            currentFinalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setFinalTranscript(currentFinalTranscript); // 확정된 부분 업데이트
        setTranscript(currentFinalTranscript + interimTranscript); // 전체 보여주기용 (확정 + 중간)
        setSpeechStatus("음성 인식 중..."); // 상태 업데이트
      };

      recog.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error", event.error, event.message);
        let errorMessage = "음성 인식 중 오류가 발생했습니다.";
        if (event.error === "no-speech") {
          errorMessage = "음성이 감지되지 않았습니다. 마이크를 확인해주세요.";
        } else if (event.error === "audio-capture") {
          errorMessage = "마이크 접근에 문제가 발생했습니다. 마이크 설정을 확인해주세요.";
        } else if (event.error === "not-allowed") {
          errorMessage = "마이크 사용 권한이 차단되었습니다. 브라우저 설정을 확인해주세요.";
        } else if (event.error === "network") {
            errorMessage = "네트워크 오류로 음성 인식을 사용할 수 없습니다.";
        }
        setMicError(errorMessage);
        setListening(false);
        setSpeechStatus("");
      };

      recog.onnomatch = () => {
        setSpeechStatus("음성을 인식하지 못했어요. 다시 말씀해주시겠어요?");
      };

      try {
        setPromptText(""); // 음성 입력 시작 시 최종 질문 칸 비우기 (선택 사항)
        recog.start();
      } catch (e) {
        console.error("Error starting speech recognition:", e);
        setMicError("음성 인식을 시작할 수 없습니다.");
        setListening(false);
        setSpeechStatus("");
      }
    }
  };

  // handleSend, examples, toggleViewMode, toggleExpand, getButtonClass, getInputClass 기존 로직 유지
  // ... (기존 handleSend 및 기타 함수들)
  const handleSend = useCallback(() => {
    const trimmedPrompt = promptText.trim();
    if (!trimmedPrompt) {
      alert("먼저 질문을 입력하거나 말해주세요.");
      return;
    }
    const userMsg: Message = {
      id: Date.now(),
      role: "user",
      content: trimmedPrompt,
      category: "일반",
    };
    const placeholderMsg: Message = {
      id: Date.now() + 1,
      role: "assistant",
      content: "생각중입니다...",
      isPlaceholder: true,
      category: "일반",
    };
    setMessages((prev) => [...prev, userMsg, placeholderMsg]);
    setHistory((prevHistory) => {
      const newHistory = [trimmedPrompt, ...prevHistory.filter(h => h !== trimmedPrompt)];
      return newHistory.slice(0, 3);
    });
    setTranscript("");
    setFinalTranscript("");
    setPromptText("");
    setMicError("");
    setSpeechStatus("");

    setTimeout(() => {
      const randomDummy = dummyResponses[Math.floor(Math.random() * dummyResponses.length)];
      const botMsg: Message = {
        id: Date.now() + 2,
        role: "assistant",
        content: randomDummy.content,
        originalContent: randomDummy.originalContent,
        category: randomDummy.category,
        isExpanded: false,
      };
      setViewModes(prev => ({...prev, [botMsg.id]: "simplified"}));
      setExpandedStates(prev => ({...prev, [botMsg.id]: (botMsg.content.length <= 100) }));
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

  const toggleViewMode = (id: number) => {
    setViewModes(prev => ({
      ...prev,
      [id]: prev[id] === "simplified" ? "original" : "simplified"
    }));
  };

  const toggleExpand = (id: number) => {
    setExpandedStates(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getButtonClass = (isActive: boolean = false) =>
    `px-4 py-2 min-h-[52px] rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-colors duration-150 ease-in-out
     text-gray-800 dark:text-gray-200
     ${isActive ?
        'bg-blue-500 dark:bg-blue-600 text-white ring-blue-400 dark:ring-blue-500 hc:bg-blue-500 hc:text-white' :
        'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 ring-gray-300 dark:ring-gray-500 hc:bg-white hc:hover:bg-gray-100'
     }
     hc:border-2 hc:border-black`;

  const getInputClass = () =>
    `w-full min-h-[52px] border p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500
     bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600
     hc:border-2 hc:border-black hc:text-black hc:bg-white`;


  return (
    <main
      role="main"
      style={{ fontSize: `${fontScale}rem` }}
      className={`relative flex flex-col lg:flex-row w-full min-h-screen h-full gap-4 lg:gap-8 py-4 px-2 md:px-4
                 text-gray-900 transition-colors duration-150 ease-in-out overflow-y-auto
                 bg-yellow-50
                 dark:bg-gray-900 dark:text-gray-100
                 hc:bg-white hc:text-black`}
    >
      {/* ... (상단 컨트롤 바 기존과 동일) ... */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20 p-2 bg-white/80 dark:bg-gray-800/80 hc:bg-white/80 hc:border hc:border-black backdrop-blur-sm rounded-lg shadow-md">
        <button onClick={() => setFontLevel((l) => Math.max(1, l - 1))} className={getButtonClass(false) + " hc:text-black"} aria-label="글자 작게"> 작게 </button>
        <button onClick={() => setFontLevel(5)} className={getButtonClass(false) + " hc:text-black"} aria-label="글자 원래대로"> 보통 </button>
        <button onClick={() => setFontLevel((l) => Math.min(10, l + 1))} className={getButtonClass(false) + " hc:text-black"} aria-label="글자 크게"> 크게 </button>

        <button onClick={() => setTheme("light")} className={getButtonClass(theme === "light")} aria-label="라이트 모드">☀️</button>
        <button onClick={() => setTheme("dark")} className={getButtonClass(theme === "dark")} aria-label="다크 모드">🌙</button>
        <button onClick={() => setTheme("high-contrast")} className={getButtonClass(theme === "high-contrast")} aria-label="고대비 모드">👁️</button>
      </div>

      {/* LEFT PANEL */}
      <motion.div
        role="region"
        aria-label="입력 패널"
        className={`flex-shrink-0 p-4 md:p-6 rounded-2xl shadow-xl w-full lg:w-1/3 xl:w-1/4 flex flex-col justify-between mt-20 lg:mt-4
                    bg-white
                    dark:bg-gray-800
                    hc:border-2 hc:border-black hc:bg-white`}
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div>
            <h1 className="w-full text-center text-3xl font-bold mb-4 text-gray-800 dark:text-gray-200 hc:text-black">
            🎙️ 말로 만나는 복지 도우미
            </h1>
            <div className="space-y-4">
            <div className="flex space-x-2 items-center"> {/* items-center 추가 */}
                <button
                  onClick={toggleListen}
                  aria-label={listening ? "음성 인식 중지" : "음성 인식 시작"}
                  className={`flex-1 min-h-[52px] py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all duration-150 ease-in-out font-semibold relative overflow-hidden
                              ${listening
                                  ? 'bg-red-500 hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-800 text-white ring-red-400 dark:ring-red-500 hc:bg-red-500 hc:text-white hc:border-black'
                                  : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white ring-blue-400 dark:ring-blue-500 hc:bg-blue-600 hc:text-white hc:border-black'
                              }`}
                >
                  {/* 말하기 버튼 시각적 피드백 */}
                  {listening && (
                    <motion.div
                      className="absolute inset-0 bg-white opacity-20"
                      animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                      transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                  {listening ? "■ 중지" : "🎤 말하기"}
                </button>
                <button
                  onClick={() => {
                      setTranscript("");
                      setFinalTranscript("");
                      setPromptText("");
                      setMicError("");
                      setSpeechStatus("");
                      if (listening && recogRef.current) { // 듣고 있을 때 지우기를 누르면 중지도 함께
                        recogRef.current.stop();
                      }
                  }}
                  className={getButtonClass(false) + ` font-semibold hc:text-black`}
                  aria-label="입력 내용 지우기"
                >
                  지우기
                </button>
            </div>

            {/* 음성 인식 상태 및 오류 메시지 표시 */}
            {(speechStatus || micError) && (
              <div className={`p-2 rounded-md text-sm text-center transition-opacity duration-300
                ${micError ?
                    'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200 hc:bg-red-100 hc:text-red-700 hc:border hc:border-red-700' :
                    'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300 hc:bg-blue-50 hc:text-blue-700 hc:border hc:border-blue-700'
                }`}
                role="status" // 오류 시에는 role="alert"도 고려
                aria-live="polite"
              >
                {micError || speechStatus}
              </div>
            )}

            <div>
                <label htmlFor="transcriptArea" className="font-medium text-gray-700 dark:text-gray-300 hc:text-black">
                📝 인식된 텍스트
                </label>
                <textarea
                  id="transcriptArea" // id 변경 (기존 transcript는 상태명과 중복)
                  rows={3}
                  className={getInputClass()}
                  value={transcript} // 중간 결과 포함된 전체 내용 표시
                  onChange={(e) => {
                      setTranscript(e.target.value);
                      // 타이핑 시 finalTranscript도 업데이트하여 promptText와 동기화되도록 함 (선택적)
                      setFinalTranscript(e.target.value);
                      setPromptText(e.target.value);
                  }}
                  placeholder={listening && !transcript ? "듣고 있어요..." : "음성 인식 결과가 여기에 표시됩니다..."}
                  readOnly={listening} // 듣고 있을 때는 편집 방지 (선택적)
                />
            </div>
            {/* ... (최종 질문, 예시 문장, 최근 질문 등 기존 UI 유지) ... */}
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
                        setFinalTranscript(ex); // 예시 선택 시 finalTranscript도 업데이트
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
                            setFinalTranscript(h); // 히스토리 선택 시 finalTranscript도 업데이트
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

      {/* RIGHT PANEL (기존과 동일) */}
      {/* ... */}
      <motion.section
        role="region"
        aria-label="응답 패널"
        className={`flex-1 p-4 md:p-6 overflow-y-auto space-y-4 rounded-2xl shadow-xl mt-4 lg:mt-20
                    bg-white
                    dark:bg-gray-800
                    hc:border-2 hc:border-black hc:bg-white`}
        initial={{ x: 50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        aria-live="polite"
      >
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.article
              key={msg.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className={`max-w-full lg:max-w-3xl p-4 rounded-xl shadow  font-medium
                ${ msg.role === "user"
                  ? "mr-auto bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hc:bg-gray-100 hc:text-black hc:border hc:border-gray-400"
                  : "ml-auto bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hc:bg-blue-100 hc:text-black hc:border hc:border-blue-400"
                }`}
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
                    <div className="mt-2 flex flex-wrap gap-2">
                    {msg.originalContent && (
                        <button
                            onClick={() => toggleViewMode(msg.id)}
                            className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 hc:bg-gray-300 hc:text-black"
                        >
                            {viewModes[msg.id] === 'simplified' ? '원문 보기' : '쉬운 설명 보기'}
                        </button>
                    )}
                    {(msg.content.length > 100 || (msg.originalContent && viewModes[msg.id] === 'original' && msg.originalContent.length > 100)) && (
                        <button
                            onClick={() => toggleExpand(msg.id)}
                            className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 hc:bg-gray-300 hc:text-black"
                        >
                            {expandedStates[msg.id] ? '간략히 보기' : '더 보기'}
                        </button>
                    )}
                    </div>
                  )}
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