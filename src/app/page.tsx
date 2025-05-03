import SpeechRecognizer from '../components/SpeechRecognizer';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-10 bg-white text-black">
      <h1 className="text-4xl font-bold mb-4">🎤 복지 정책 음성 챗봇</h1>
      <p className="text-lg">마이크 버튼을 눌러 정책을 찾아보세요!</p>
      <SpeechRecognizer />
    </main>
  );
}
