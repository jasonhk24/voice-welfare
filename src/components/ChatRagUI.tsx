// src/components/ChatRagUI.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ... (기존 타입 선언들 SpeechRecognition, Message, Theme 등은 동일하게 유지)
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

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
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
    speechSynthesis: SpeechSynthesis; // TTS를 위한 SpeechSynthesis 타입 추가
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
  isPlaying?: boolean; // TTS 재생 상태를 위한 필드
}

type Theme = "light" | "dark" | "high-contrast";


export default function ChatRagUI() {
  const [fontLevel, setFontLevel] = useState(5);
  const fontScale = fontLevel / 5;
  const [theme, setTheme] = useState<Theme>("light");
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  // finalTranscript 상태는 이제 onresult에서 promptText를 직접 업데이트하므로, UI 표시용 transcript만 있어도 괜찮을 수 있습니다.
  // 하지만 명확성을 위해 유지하거나, 필요 없다면 제거할 수도 있습니다. 여기서는 유지하고 onresult에서 함께 업데이트합니다.
  const [finalTranscriptForDisplay, setFinalTranscriptForDisplay] = useState("");
  const [promptText, setPromptText] = useState("");
  const recogRef = useRef<SpeechRecognition | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [viewModes, setViewModes] = useState<Record<number, "simplified" | "original">>({});
  const [expandedStates, setExpandedStates] = useState<Record<number, boolean>>({});
  const [history, setHistory] = useState<string[]>([]);
  const [speechStatus, setSpeechStatus] = useState<string>("");
  const [micError, setMicError] = useState<string>("");

  // TTS 관련 상태
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const dummyResponses: Omit<Message, "id" | "role">[] = [ /* ... 기존과 동일 ... */ ];
  useEffect(() => { /* ... 기존 테마 로딩 useEffect ... */ }, []);
  useEffect(() => { /* ... 기존 테마 적용 useEffect ... */ }, [theme]);

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
      // TTS 재생 중이면 중지
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setMessages(prev => prev.map(m => ({ ...m, isPlaying: false })));
      }

      const recog = new SR() as SpeechRecognition;
      recogRef.current = recog;
      recog.lang = "ko-KR";
      recog.interimResults = true;
      // recog.continuous = false; // 한 번의 발화 후 자동 종료 (기본값)

      recog.onstart = () => {
        setListening(true);
        setSpeechStatus("듣고 있어요... 말씀해주세요.");
        setMicError("");
        setTranscript("");
        setFinalTranscriptForDisplay("");
        setPromptText(""); // 음성 입력 시작 시 최종 질문 칸 초기화
      };

      recog.onend = () => {
        setListening(false);
        setSpeechStatus("");
        // promptText는 onresult의 isFinal에서 이미 설정되었을 것이므로,
        // 여기서는 특별히 promptText를 다시 설정할 필요는 없을 수 있습니다.
        // 다만, 혹시 모를 케이스를 위해 최종 transcript 기준으로 한번 더 동기화 할 수 있습니다.
        if (finalTranscriptForDisplay.trim() && !promptText.trim()) {
             setPromptText(finalTranscriptForDisplay.trim());
        }
      };

      recog.onresult = (event: SpeechRecognitionEvent) => {
        let interim_transcript = "";
        let final_transcript_piece = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript_segment = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final_transcript_piece += transcript_segment;
          } else {
            interim_transcript += transcript_segment;
          }
        }

        // 최종 확정된 부분(final_transcript_piece)이 있다면, promptText와 finalTranscriptForDisplay를 업데이트
        if (final_transcript_piece) {
          const newFinalText = (finalTranscriptForDisplay + final_transcript_piece).trim();
          setFinalTranscriptForDisplay(newFinalText);
          setPromptText(newFinalText); // << 중요: 최종 질문 필드(promptText) 직접 업데이트
          setTranscript(newFinalText + " " + interim_transcript); // 화면 표시용은 최종 + 중간 결과
        } else {
          // 중간 결과만 있을 경우, 화면 표시용 transcript만 업데이트
          setTranscript(finalTranscriptForDisplay + " " + interim_transcript);
        }

        if (interim_transcript) {
            setSpeechStatus("음성 인식 중...");
        }
      };

      recog.onerror = (event: SpeechRecognitionErrorEvent) => { /* ... 기존과 동일 ... */
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
      recog.onnomatch = () => { /* ... 기존과 동일 ... */
        setSpeechStatus("음성을 인식하지 못했어요. 다시 말씀해주시겠어요?");
      };

      try {
        recog.start();
      } catch (e) { /* ... 기존과 동일 ... */
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
    // TTS 재생 중이면 중지
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
        isExpanded: (randomDummy.content.length <= 100), isPlaying: false
      };
      setViewModes(prev => ({...prev, [botMsg.id]: "simplified"}));
      // setExpandedStates는 Message isExpanded 기본값으로 대체
      setMessages((prev) => [...prev.filter((m) => !m.isPlaceholder), botMsg]);
    }, 2000);
  }, [promptText, dummyResponses]); // dummyResponses 추가

  const examples = [ /* ... 기존과 동일 ... */ ];
  const toggleViewMode = (id: number) => { /* ... 기존과 동일 ... */ };
  const toggleExpand = (id: number) => {
    setMessages(prevMessages => prevMessages.map(msg =>
      msg.id === id ? { ...msg, isExpanded: !msg.isExpanded } : msg
    ));
  };
  const getButtonClass = (isActive: boolean = false) => { /* ... 기존과 동일 ... */ };
  const getInputClass = () => { /* ... 기존과 동일 ... */ };

  // TTS 재생/정지 함수
  const handleSpeak = (message: Message) => {
    if (!window.speechSynthesis) {
      alert("음성 출력을 지원하지 않는 브라우저입니다.");
      return;
    }

    // 현재 메시지가 이미 재생 중이면 취소
    if (message.isPlaying) {
      window.speechSynthesis.cancel();
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, isPlaying: false } : m));
      return;
    }

    // 다른 메시지 재생 중이면 그것부터 취소 및 상태 초기화
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setMessages(prev => prev.map(m => ({ ...m, isPlaying: false })));
    }

    const textToSpeak = viewModes[message.id] === 'original' && message.originalContent
                        ? message.originalContent
                        : message.content;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "ko-KR"; // 한국어 설정
    utterance.pitch = 1;
    utterance.rate = 1; // 속도 조절 가능 (0.1 ~ 10)

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
      alert("음성 출력 중 오류가 발생했습니다.");
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // 컴포넌트 언마운트 시 TTS 정리
  useEffect(() => {
    return () => {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);


  return (
    <main /* ... 기존 main 태그 속성 ... */ >
      {/* ... (상단 컨트롤 바 기존과 동일) ... */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20 p-2 bg-white/80 dark:bg-gray-800/80 hc:bg-white/80 hc:border hc:border-black backdrop-blur-sm rounded-lg shadow-md">
        <button onClick={() => setFontLevel((l) => Math.max(1, l - 1))} className={getButtonClass(false) + " hc:text-black"} aria-label="글자 작게"> 작게 </button>
        <button onClick={() => setFontLevel(5)} className={getButtonClass(false) + " hc:text-black"} aria-label="글자 원래대로"> 보통 </button>
        <button onClick={() => setFontLevel((l) => Math.min(10, l + 1))} className={getButtonClass(false) + " hc:text-black"} aria-label="글자 크게"> 크게 </button>

        <button onClick={() => setTheme("light")} className={getButtonClass(theme === "light")} aria-label="라이트 모드">☀️</button>
        <button onClick={() => setTheme("dark")} className={getButtonClass(theme === "dark")} aria-label="다크 모드">🌙</button>
        <button onClick={() => setTheme("high-contrast")} className={getButtonClass(theme === "high-contrast")} aria-label="고대비 모드">👁️</button>
      </div>

      <motion.div /* ... 기존 왼쪽 입력 패널 ... */ >
        {/* ... (기존 왼쪽 입력 패널 내용, speechStatus, micError 표시 부분 포함) ... */}
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
            {history.length > 0 && ( /* ... 최근 질문 UI ... */ )}
            </div>
        </div>
        <button /* ... 확인&전송 버튼 ... */ >✅ 확인 & 전송</button>
      </motion.div>

      <motion.section /* ... 오른쪽 응답 패널 ... */ >
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.article
              key={msg.id}
              /* ... 기존 article 속성 ... */
              className={`max-w-full lg:max-w-3xl p-4 rounded-xl shadow font-medium relative group ${ /* group 클래스 추가 */
                msg.role === "user"
                  ? "mr-auto bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hc:bg-gray-100 hc:text-black hc:border hc:border-gray-400"
                  : "ml-auto bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hc:bg-blue-100 hc:text-black hc:border hc:border-blue-400"
              }`}
            >
              {/* TTS 버튼 (챗봇 메시지에만 표시) */}
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

              {msg.isPlaceholder ? ( /* ... 플레이스홀더 내용 ... */ ) : (
                <>
                  <pre className="whitespace-pre-wrap text-left">
                    {msg.role === 'assistant' && viewModes[msg.id] === 'original' && msg.originalContent
                      ? msg.originalContent
                      : msg.content}
                  </pre>
                  {msg.role === 'assistant' && (
                    <div className="mt-2 flex flex-wrap gap-2 items-center"> {/* items-center 추가 */}
                      {/* ... 원문/쉬운설명, 더보기/간략히 버튼 ... */}
                       {msg.originalContent && (
                            <button
                                onClick={() => toggleViewMode(msg.id)}
                                className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 hc:bg-gray-300 hc:text-black"
                            >
                                {viewModes[msg.id] === 'simplified' ? '원문 보기' : '쉬운 설명 보기'}
                            </button>
                        )}
                        {/* isExpanded 상태를 Message 객체에서 직접 사용 */}
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
        {messages.length === 0 && ( /* ... 초기 안내 메시지 ... */ )}
      </motion.section>
    </main>
  );
}