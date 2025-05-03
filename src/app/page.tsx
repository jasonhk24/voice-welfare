import SpeechToChat from '../components/SpeechToChat';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white text-black p-6">
      <h1 className="text-4xl font-bold mb-6">🎤 복지 정책 챗봇</h1>
      <SpeechToChat />
    </main>
  );
}
