
import React, { useState, useRef, useEffect } from 'react';
import { generateSpeech, generateLyrics } from './services/geminiService';
import { decode, decodeAudioData, createWavBlob } from './utils/audioUtils';
import Loader from './components/Loader';
import SpeakerIcon from './components/SpeakerIcon';
import DownloadIcon from './components/DownloadIcon';
import ComposeIcon from './components/ComposeIcon';

type Tab = 'tts' | 'compose';

const VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];
const DEFAULT_TTS_TEXT = "Xin chào! Tôi là trợ lý AI thân thiện được cung cấp bởi Gemini. Hãy gõ nội dung vào đây và tôi sẽ đọc to cho bạn bằng giọng bạn chọn.";
const DEFAULT_LYRICS_PROMPT = "Một bài hát nhẹ nhàng về những vì sao trên bầu trời đêm.";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('tts');
  
  // TTS State
  const [text, setText] = useState<string>(DEFAULT_TTS_TEXT);
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState<boolean>(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Lyrics Composer State
  const [lyricsPrompt, setLyricsPrompt] = useState<string>(DEFAULT_LYRICS_PROMPT);
  const [generatedLyrics, setGeneratedLyrics] = useState<string>('');
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState<boolean>(false);
  const [lyricsError, setLyricsError] = useState<string | null>(null);

  useEffect(() => {
    try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    } catch (e) {
        setTtsError("AudioContext không được trình duyệt của bạn hỗ trợ.");
    }

    return () => {
        audioContextRef.current?.close();
    };
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setGeneratedAudio(null); // Invalidate download when text changes
  }

  const handleGenerateSpeech = async () => {
    if (!text.trim()) {
      setTtsError('Vui lòng nhập văn bản để tạo giọng nói.');
      return;
    }
    if (!audioContextRef.current) {
        setTtsError("Audio context chưa được khởi tạo. Vui lòng tải lại trang.");
        return;
    }
    
    setGeneratedAudio(null);
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    
    if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
    }

    setIsGeneratingSpeech(true);
    setTtsError(null);

    try {
      const base64Audio = await generateSpeech(text, selectedVoice);
      
      if (base64Audio && audioContextRef.current) {
        setGeneratedAudio(base64Audio);
        const audioData = decode(base64Audio);
        const audioBuffer = await decodeAudioData(audioData, audioContextRef.current);
        
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.start();

        audioSourceRef.current = source;
        source.onended = () => {
            audioSourceRef.current = null;
        };

      } else {
        setTtsError('Không thể tạo âm thanh. Phản hồi trống.');
      }
    } catch (e: any) {
      console.error(e);
      setTtsError(e.message || 'Đã xảy ra lỗi không xác định.');
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  const handleDownload = () => {
    if (!generatedAudio) {
        setTtsError("Không có âm thanh để tải về.");
        return;
    }
    try {
        const pcmData = decode(generatedAudio);
        const wavBlob = createWavBlob(pcmData, 24000, 1);
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'gemini-speech.wav';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    } catch (e: any) {
        console.error("Lỗi tải về:", e);
        setTtsError("Tải về thất bại: " + e.message);
    }
  };

  const handleGenerateLyrics = async () => {
    if (!lyricsPrompt.trim()) {
      setLyricsError('Vui lòng nhập chủ đề để sáng tác.');
      return;
    }
    setIsGeneratingLyrics(true);
    setLyricsError(null);
    setGeneratedLyrics('');
    try {
      const lyrics = await generateLyrics(lyricsPrompt);
      setGeneratedLyrics(lyrics);
    } catch (e: any) {
      console.error(e);
      setLyricsError(e.message || 'Đã xảy ra lỗi không xác định.');
    } finally {
      setIsGeneratingLyrics(false);
    }
  };

  const sendLyricsToTts = () => {
    setText(generatedLyrics);
    setActiveTab('tts');
    setGeneratedAudio(null);
  };

  const renderTtsTab = () => (
    <div className="space-y-6">
       {ttsError && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-center" role="alert">
                <p>{ttsError}</p>
            </div>
        )}
        <textarea
            value={text}
            onChange={handleTextChange}
            placeholder="Nhập văn bản tại đây..."
            className="w-full h-48 p-4 bg-gray-900/70 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors duration-200 resize-none text-gray-200 placeholder-gray-500"
            disabled={isGeneratingSpeech}
        />
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <div className="sm:col-span-2">
                <label htmlFor="voice-select" className="block text-sm font-medium text-gray-400 mb-1">Chọn giọng nói</label>
                <select
                    id="voice-select"
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    disabled={isGeneratingSpeech}
                    className="w-full p-3 h-[48px] bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors duration-200 appearance-none"
                >
                    {VOICES.map(voice => <option key={voice} value={voice}>{voice}</option>)}
                </select>
            </div>
            <div className="sm:col-span-3 flex items-end gap-4">
                <button
                    onClick={handleGenerateSpeech}
                    disabled={isGeneratingSpeech || !text.trim()}
                    className="flex-1 h-[48px] bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-100 disabled:scale-100"
                >
                    {isGeneratingSpeech ? <Loader /> : <><SpeakerIcon /><span className="ml-2">Tạo giọng nói</span></>}
                </button>
                <button
                    onClick={handleDownload}
                    disabled={isGeneratingSpeech || !generatedAudio}
                    className="flex-1 h-[48px] bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-100 disabled:scale-100"
                >
                    <DownloadIcon /><span className="ml-2">Tải về</span>
                </button>
            </div>
        </div>
    </div>
  );

  const renderComposeTab = () => (
    <div className="space-y-6">
        {lyricsError && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-center" role="alert">
                <p>{lyricsError}</p>
            </div>
        )}
        <textarea
            value={lyricsPrompt}
            onChange={(e) => setLyricsPrompt(e.target.value)}
            placeholder="Nhập chủ đề hoặc ý tưởng cho bài hát..."
            className="w-full h-24 p-4 bg-gray-900/70 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200 resize-none text-gray-200 placeholder-gray-500"
            disabled={isGeneratingLyrics}
        />
        <button
            onClick={handleGenerateLyrics}
            disabled={isGeneratingLyrics || !lyricsPrompt.trim()}
            className="w-full h-[48px] bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-100 disabled:scale-100"
        >
            {isGeneratingLyrics ? <Loader /> : <><ComposeIcon /><span className="ml-2">Sáng tác</span></>}
        </button>
        {(generatedLyrics || isGeneratingLyrics) && (
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-300">Lời bài hát được tạo:</h3>
                <div className="w-full h-64 p-4 bg-gray-900/70 border border-gray-700 rounded-lg overflow-y-auto whitespace-pre-wrap text-gray-200">
                    {isGeneratingLyrics ? 'Đang sáng tác...' : generatedLyrics}
                </div>
                 <button
                    onClick={sendLyricsToTts}
                    disabled={isGeneratingLyrics || !generatedLyrics}
                    className="w-full h-[48px] bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-all duration-300"
                >
                    <SpeakerIcon />
                    <span className="ml-2">Gửi đến TTS</span>
                </button>
            </div>
        )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 transform transition-all duration-300">
        <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-cyan-400">Gemini AI Studio</h1>
            <p className="text-gray-400 mt-2">Sáng tạo nội dung với sức mạnh của trí tuệ nhân tạo.</p>
        </div>
        
        <div className="border-b border-gray-700">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                 <button
                    onClick={() => setActiveTab('tts')}
                    className={`${
                        activeTab === 'tts'
                        ? 'border-cyan-400 text-cyan-300'
                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                >
                    Chuyển văn bản thành giọng nói
                </button>
                <button
                    onClick={() => setActiveTab('compose')}
                    className={`${
                        activeTab === 'compose'
                        ? 'border-purple-400 text-purple-300'
                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                >
                    Sáng tác lời nhạc
                </button>
            </nav>
        </div>
        
        <div className="pt-4">
            {activeTab === 'tts' ? renderTtsTab() : renderComposeTab()}
        </div>

      </div>
    </div>
  );
}

export default App;
