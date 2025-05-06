// src/components/ChatRagUI.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Web Speech API (STT) 타입 선언
type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: () => void;
  onresult: (e: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (e: SpeechRecognitionErrorEvent) => void;
  onnomatch: () => void;
  start(): void;
  stop(): void;
};

// SpeechRecognitionErrorEvent는 error와 message 속성을 가질 수 있습니다.
// 표준 Event 타입과 다를 수 있어 명시적으로 정의합니다.
interface SpeechRecognitionErrorEvent extends Event {
  error: string; // 예: 'no-speech', 'audio-capture', 'not-allowed'
  message: string; // 오류에 대한 설명 메시지 (브라우저 제공)
}

// SpeechRecognitionEvent는 results와 resultIndex 속성을 가집니다.
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number; // 변경된 첫 번째 결과의 인덱스
}

// SpeechRecognitionResultList는 SpeechRecognitionResult의 배열과 유사한 객체입니다.
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult; // 인덱스로 직접 접근 허용
}

// SpeechRecognitionResult는 isFinal과 SpeechRecognitionAlternative 배열을 가집니다.
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative; // 인덱스로 직접 접근 허용
}

// SpeechRecognitionAlternative는 실제 인식된 텍스트와 신뢰도를 가집니다.
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

// 전역 window 객체에 Web Speech API 및 TTS API 타입 추가
declare global {
  interface Window {
    SpeechRecognition?: { new (): SpeechRecognition }; // 브라우저 지원 여부 확인 위해 Optional chaining
    webkitSpeechRecognition?: { new (): SpeechRecognition }; // Chrome계열 접두사
    speechSynthesis?: SpeechSynthesis; // Web Speech API (TTS)
  }
}

// 채팅 메시지 구조 정의
interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  originalContent?: string; // "원문 보기"를 위한 필드
  isPlaceholder?: boolean;
  isExpanded?: boolean; // "더 보기" 기능을 위한 필드
  category?: "연금" | "고용" | "복지" | "일반"; // 로딩 애니메이션 및 스타일링용
  isPlaying?: boolean; // TTS 재생 상태를 위한 필드
}

// 테마 타입 정의
type Theme = "light" | "dark" | "high-contrast";

export default function ChatRagUI() {
  const [fontLevel, setFontLevel] = useState(5);
  const fontScale = fontLevel / 5;
  const [theme, setTheme] = useState<Theme>("light");
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [finalTranscriptForDisplay, setFinalTranscriptForDisplay] = useState("");
  const [promptText, setPromptText] = useState("");
  const recogRef = useRef<SpeechRecognition | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [viewModes, setViewModes] = useState<Record<number, "simplified" | "original">>({});
  const [history, setHistory] = useState<string[]>([]);
  const [speechStatus, setSpeechStatus] = useState<string>("");
  const [micError, setMicError] = useState<string>("");

  // TTS 관련 상태
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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
    } else {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setMessages(prev => prev.map(m => ({ ...m, isPlaying: false })));
      }

      const recog = new SR() as SpeechRecognition;
      recogRef.current = recog;
      recog.lang = "ko-KR";
      recog.interimResults = true;
      recog.continuous = false; // 한 번의 발화 후 자동 종료 (필요시 true로 변경)


      recog.onstart = () => {
        setListening(true);
        setSpeechStatus("듣고 있어요... 말씀해주세요.");
        setMicError("");
        setTranscript("");
        setFinalTranscriptForDisplay("");
        setPromptText("");
      };

      recog.onend = () => {
        setListening(false);
        setSpeechStatus("");
        // onresult에서 isFinal일 때 promptText가 이미 설정되었을 가능성이 높음
        // 만약 finalTranscriptForDisplay가 더 최신이거나 확실하다면 여기서 한 번 더 설정
        if (finalTranscriptForDisplay.trim() && promptText !== finalTranscriptForDisplay.trim()) {
             setPromptText(finalTranscriptForDisplay.trim());
        }
      };

      recog.onresult = (event: SpeechRecognitionEvent) => {
        let interim_transcript_piece = "";
        let final_transcript_piece = "";
        let current_final_text_so_far = finalTranscriptForDisplay; // 현재까지 누적된 final 텍스트

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const segment = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final_transcript_piece += segment;
          } else {
            interim_transcript_piece += segment;
          }
        }

        if (final_transcript_piece) {
          // 이전 누적된 final 텍스트와 현재 이벤트의 final 조각을 합침
          // (continuous = false 일 경우, 보통 이전 final은 없고 현재 조각만 final이 됨)
          current_final_text_so_far = (current_final_text_so_far + " " + final_transcript_piece).trim();
          setFinalTranscriptForDisplay(current_final_text_so_far);
          setPromptText(current_final_text_so_far);
        }

        setTranscript((current_final_text_so_far + " " + interim_transcript_piece).trim());

        if (interim_transcript_piece || final_transcript_piece) {
            setSpeechStatus("음성 인식 중...");
        }
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
        recog.start();
      } catch (e) {
        console.error("Error starting speech recognition:", e);
        setMicError("음성 인식을 시작할 수 없습니다.");
        setListening(false);
        setSpeechStatus("");
      }
    }
  };

  const handleSend = useCallback(() => {
    const trimmedPrompt = promptText.trim();
    if (!trimmedPrompt) {
      alert("먼저 질문을 입력하거나 말해주세요.");
      return;
    }
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setMessages(prev => prev.map(m => ({ ...m, isPlaying: false })));
    }

    const userMsg: Message = { id: Date.now(), role: "user", content: trimmedPrompt, category: "일반" };
    const placeholderMsg: Message = { id: Date.now() + 1, role: "assistant", content: "생각중입니다...", isPlaceholder: true, category: "일반" };
    setMessages((prev) => [...prev, userMsg, placeholderMsg]);
    setHistory((prevHistory) => [trimmedPrompt, ...prevHistory.filter(h => h !== trimmedPrompt)].slice(0, 3));
    setTranscript("");
    setFinalTranscriptForDisplay("");
    setPromptText("");
    setMicError("");
    setSpeechStatus("");

    setTimeout(() => {
      const randomDummy = dummyResponses[Math.floor(Math.random() * dummyResponses.length)];
      const botMsg: Message = {
        id: Date.now() + 2, role: "assistant", content: randomDummy.content,
        originalContent: randomDummy.originalContent, category: randomDummy.category,
        isExpanded: (randomDummy.content.length <= 100),
        isPlaying: false
      };
      setViewModes(prev => ({...prev, [botMsg.id]: "simplified"}));
      setMessages((prev) => [...prev.filter((m) => !m.isPlaceholder), botMsg]);
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
    setMessages(prevMessages => prevMessages.map(msg =>
      msg.id === id ? { ...msg, isExpanded: !msg.isExpanded } : msg
    ));
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

  const handleSpeak = (message: Message) => {
    if (!window.speechSynthesis) {
      alert("음성 출력을 지원하지 않는 브라우저입니다.");
      return;
    }
    if (message.isPlaying) {
      window.speechSynthesis.cancel();
      // onend 핸들러가 isPlaying을 false로 설정하므로 여기서 중복 호출 안 해도 될 수 있음
      // setMessages(prev => prev.map(m => m.id === message.id ? { ...m, isPlaying: false } : m));
      return;
    }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setMessages(prev => prev.map(m => ({ ...m, isPlaying: false })));
    }
    const textToSpeak = viewModes[message.id] === 'original' && message.originalContent
                        ? message.originalContent
                        : message.content;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "ko-KR";
    utterance.pitch = 1;
    utterance.rate = 1;
    utterance.onstart = () => {
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, isPlaying: true } : { ...m, isPlaying: false }));
    };
    utterance.onend = () => {
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, isPlaying: false } : m));
      utteranceRef.current = null;
    };
    utterance.onerror = (event) => {
      console.error("SpeechSynthesis Error", event);
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, isPlaying: false } : m));
      // alert("음성 출력 중 오류가 발생했습니다."); // 사용자에게 너무 많은 알림을 줄 수 있어 일단 주석 처리
      utteranceRef.current = null;
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20 p-2 bg-white/80 dark:bg-gray-800/80 hc:bg-white/80 hc:border hc:border-black backdrop-blur-sm rounded-lg shadow-md">
        <button onClick={() => setFontLevel((l) => Math.max(1, l - 1))} className={getButtonClass(false) + " hc:text-black"} aria-label="글자 작게"> 작게 </button>
        <button onClick={() => setFontLevel(5)} className={getButtonClass(false) + " hc:text-black"} aria-label="글자 원래대로"> 보통 </button>
        <button onClick={() => setFontLevel((l) => Math.min(10, l + 1))} className={getButtonClass(false) + " hc:text-black"} aria-label="글자 크게"> 크게 </button>

        <button onClick={() => setTheme("light")} className={getButtonClass(theme === "light")} aria-label="라이트 모드">☀️</button>
        <button onClick={() => setTheme("dark")} className={getButtonClass(theme === "dark")} aria-label="다크 모드">🌙</button>
        <button onClick={() => setTheme("high-contrast")} className={getButtonClass(theme === "high-contrast")} aria-label="고대비 모드">👁️</button>
      </div>

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
            <div className="flex space-x-2 items-center">
                <button
                  onClick={toggleListen}
                  aria-label={listening ? "음성 인식 중지" : "음성 인식 시작"}
                  className={`flex-1 min-h-[52px] py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all duration-150 ease-in-out font-semibold relative overflow-hidden
                              ${listening
                                  ? 'bg-red-500 hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-800 text-white ring-red-400 dark:ring-red-500 hc:bg-red-500 hc:text-white hc:border-black'
                                  : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white ring-blue-400 dark:ring-blue-500 hc:bg-blue-600 hc:text-white hc:border-black'
                              }`}
                >
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
                      setFinalTranscriptForDisplay("");
                      setPromptText("");
                      setMicError("");
                      setSpeechStatus("");
                      if (listening && recogRef.current) {
                        recogRef.current.stop();
                      }
                  }}
                  className={getButtonClass(false) + ` font-semibold hc:text-black`}
                  aria-label="입력 내용 지우기"
                >
                  지우기
                </button>
            </div>

            {(speechStatus || micError) && (
              <div className={`p-2 rounded-md text-sm text-center transition-opacity duration-300
                ${micError ?
                    'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200 hc:bg-red-100 hc:text-red-700 hc:border hc:border-red-700' :
                    'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300 hc:bg-blue-50 hc:text-blue-700 hc:border hc:border-blue-700'
                }`}
                role={micError ? "alert" : "status"}
                aria-live={micError ? "assertive" : "polite"}
              >
                {micError || speechStatus}
              </div>
            )}

            <div>
                <label htmlFor="transcriptArea" className="font-medium text-gray-700 dark:text-gray-300 hc:text-black">
                📝 인식된 텍스트
                </label>
                <textarea
                  id="transcriptArea"
                  rows={3}
                  className={getInputClass()}
                  value={transcript}
                  onChange={(e) => {
                      const newText = e.target.value;
                      setTranscript(newText);
                      setFinalTranscriptForDisplay(newText);
                      setPromptText(newText);
                  }}
                  placeholder={listening && !transcript ? "듣고 있어요..." : "음성 인식 결과가 여기에 표시됩니다..."}
                  readOnly={listening}
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
                        setFinalTranscriptForDisplay(ex);
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
                            setFinalTranscriptForDisplay(h);
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
              className={`max-w-full lg:max-w-3xl p-4 rounded-xl shadow font-medium relative group ${
                msg.role === "user"
                  ? "mr-auto bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hc:bg-gray-100 hc:text-black hc:border hc:border-gray-400"
                  : "ml-auto bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hc:bg-blue-100 hc:text-black hc:border hc:border-blue-400"
              }`}
              tabIndex={0}
              role="article"
              aria-label={msg.role === "user" ? `사용자 메시지: ${msg.content.substring(0,30)}` : `챗봇 답변: ${msg.content.substring(0,30)}`}
            >
              {msg.role === 'assistant' && !msg.isPlaceholder && window.speechSynthesis && (
                <button
                  onClick={() => handleSpeak(msg)}
                  aria-label={msg.isPlaying ? "음성 재생 중지" : "메시지 음성으로 듣기"}
                  title={msg.isPlaying ? "음성 재생 중지" : "메시지 음성으로 듣기"}
                  className="absolute top-2 right-2 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hc:text-black hc:hover:bg-gray-300"
                >
                  {msg.isPlaying ? '⏹️' : '🔊'}
                </button>
              )}

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
                    {msg.role === 'assistant' && !msg.isExpanded && (msg.content.length > 100 || (msg.originalContent && viewModes[msg.id] === 'original' && msg.originalContent.length > 100))
                        ? `${(viewModes[msg.id] === 'original' && msg.originalContent ? msg.originalContent : msg.content).substring(0, 100)}...`
                        : (viewModes[msg.id] === 'original' && msg.originalContent ? msg.originalContent : msg.content)
                    }
                  </pre>
                  {msg.role === 'assistant' && (
                    <div className="mt-2 flex flex-wrap gap-2 items-center">
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
                                {msg.isExpanded ? '간략히 보기' : '더 보기'}
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