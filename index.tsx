
import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, Modality, LiveServerMessage } from "@google/genai";
import JSZip from 'jszip';
import pptxgen from "pptxgenjs";
import * as XLSX from 'xlsx';
import { 
  MessageSquare, 
  Image as ImageIcon, 
  Send, 
  Plus, 
  Loader2, 
  Download, 
  Sparkles,
  Settings,
  Copy,
  Check,
  FileText,
  FileSpreadsheet,
  Trash2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Pause,
  Play,
  ArrowRight,
  Presentation,
  BookOpen,
  ClipboardList,
  X,
  Layers,
  StopCircle,
  Archive,
  CheckSquare,
  Square,
  Bot,
  Menu,
  Monitor,
  AlertCircle
} from 'lucide-react';

// --- Utils ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

// --- Types ---
interface Message {
  role: 'user' | 'model';
  text: string;
}

type Tab = 'chat' | 'doc' | 'image' | 'live' | 'meeting';

// --- Shared Components ---

const NavButton = ({ active, onClick, icon, label, collapsed }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, collapsed: boolean }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 ${active ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
  >
    <div className={`flex-shrink-0 ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
      {icon}
    </div>
    <span className={`font-semibold text-sm transition-opacity duration-300 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
      {label}
    </span>
  </button>
);

const TabContent: React.FC<{ active: boolean, children: React.ReactNode }> = ({ active, children }) => (
  <div className={`h-full w-full absolute inset-0 transition-all duration-500 ${active ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
    {children}
  </div>
);

const MobileNavBtn = ({ active, onClick, icon }: { active: boolean, onClick: () => void, icon: React.ReactNode }) => (
  <button 
    onClick={onClick}
    className={`p-3 rounded-2xl transition-all ${active ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}
  >
    {icon}
  </button>
);

const DocBtn = ({ onClick, label, icon, color, loading }: { onClick: () => void, label: string, icon: React.ReactNode, color: string, loading: boolean }) => {
  const colorMap: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100',
  };
  return (
    <button 
      onClick={onClick} 
      disabled={loading}
      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-3xl border transition-all active:scale-95 ${colorMap[color] || colorMap.slate}`}
    >
      {loading ? <Loader2 size={24} className="animate-spin" /> : icon}
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
};

// --- App ---
const App = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!hasStarted) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-1000 bg-white">
        <div className="mb-8 pulse-soft">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-indigo-600 rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-200">
                <Bot size={isMobile ? 40 : 52} className="text-white" />
            </div>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-800 tracking-tighter mb-12">Lumina</h1>
        <button 
          onClick={() => setHasStarted(true)}
          className="group relative flex items-center gap-4 bg-indigo-600 hover:bg-indigo-700 text-white px-10 md:px-14 py-4 md:py-6 rounded-full font-bold text-lg md:text-xl transition-all shadow-xl shadow-indigo-100 active:scale-95 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] transition-transform" />
          Comece Aqui
          <ArrowRight className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-50 text-slate-700 overflow-hidden">
      {!isMobile && (
        <aside 
          onMouseEnter={() => setIsSidebarExpanded(true)}
          onMouseLeave={() => setIsSidebarExpanded(false)}
          className={`${isSidebarExpanded ? 'w-64' : 'w-20'} transition-all duration-300 soft-glass border-r border-slate-200 flex flex-col z-20 group`}
        >
          <div onClick={() => setHasStarted(false)} className="p-6 flex items-center gap-3 cursor-pointer">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg flex-shrink-0">
              <Bot size={18} className="text-white" />
            </div>
            <span className={`font-bold text-xl tracking-tight text-slate-800 transition-opacity ${isSidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>Lumina</span>
          </div>
          <nav className="flex-1 px-3 space-y-2 mt-4 overflow-hidden">
            <NavButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare size={20} />} label="Chat" collapsed={!isSidebarExpanded} />
            <NavButton active={activeTab === 'meeting'} onClick={() => setActiveTab('meeting')} icon={<ClipboardList size={20} />} label="Reunião" collapsed={!isSidebarExpanded} />
            <NavButton active={activeTab === 'doc'} onClick={() => setActiveTab('doc')} icon={<FileText size={20} />} label="Estúdio" collapsed={!isSidebarExpanded} />
            <NavButton active={activeTab === 'live'} onClick={() => setActiveTab('live')} icon={<Mic size={20} />} label="Voz Live" collapsed={!isSidebarExpanded} />
            <NavButton active={activeTab === 'image'} onClick={() => setActiveTab('image')} icon={<ImageIcon size={20} />} label="Imagens" collapsed={!isSidebarExpanded} />
          </nav>
        </aside>
      )}

      <main className="flex-1 flex flex-col relative overflow-hidden pb-16 md:pb-0">
        <div className="flex-1 overflow-hidden h-full relative">
          <TabContent active={activeTab === 'chat'}><ChatView isMobile={isMobile} /></TabContent>
          <TabContent active={activeTab === 'meeting'}><MeetingView isMobile={isMobile} /></TabContent>
          <TabContent active={activeTab === 'doc'}><DocStudioView isMobile={isMobile} /></TabContent>
          <TabContent active={activeTab === 'live'}><LiveVoiceView isMobile={isMobile} /></TabContent>
          <TabContent active={activeTab === 'image'}><ImageView isMobile={isMobile} /></TabContent>
        </div>
      </main>

      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 px-6 py-3 flex justify-between items-center z-30">
          <MobileNavBtn active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare size={24} />} />
          <MobileNavBtn active={activeTab === 'meeting'} onClick={() => setActiveTab('meeting')} icon={<ClipboardList size={24} />} />
          <MobileNavBtn active={activeTab === 'doc'} onClick={() => setActiveTab('doc')} icon={<FileText size={24} />} />
          <MobileNavBtn active={activeTab === 'live'} onClick={() => setActiveTab('live')} icon={<Mic size={24} />} />
          <MobileNavBtn active={activeTab === 'image'} onClick={() => setActiveTab('image')} icon={<ImageIcon size={24} />} />
        </nav>
      )}
    </div>
  );
};

// --- MeetingView ---
const MeetingView = ({ isMobile }: { isMobile: boolean }) => {
  const [status, setStatus] = useState<'idle' | 'recording' | 'paused' | 'done'>('idle');
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const extraStreamsRef = useRef<MediaStream[]>([]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'pt-BR';
      recognitionRef.current.onresult = (e: any) => {
        let cur = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) if (e.results[i].isFinal) cur += e.results[i][0].transcript + ' ';
        setTranscript(p => p + cur);
      };
      recognitionRef.current.onend = () => { if (status === 'recording') try { recognitionRef.current.start(); } catch(e){} };
    }
    return () => stopAll();
  }, [status]);

  const startCapturing = async (mode: 'mic' | 'system') => {
    setError(null);
    stopAll();
    
    try {
      let finalStream: MediaStream;

      if (mode === 'system') {
        const systemStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true, 
          audio: true 
        });
        extraStreamsRef.current.push(systemStream);

        const hasSystemAudio = systemStream.getAudioTracks().length > 0;
        
        let micStream: MediaStream | null = null;
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          extraStreamsRef.current.push(micStream);
        } catch (micErr) {
          console.warn("Microphone access denied. Continuing with system audio only if present.");
        }

        if (hasSystemAudio || micStream) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContextClass();
          audioCtxRef.current = ctx;
          const destination = ctx.createMediaStreamDestination();

          if (hasSystemAudio) {
            const systemSource = ctx.createMediaStreamSource(systemStream);
            systemSource.connect(destination);
          } else {
            setError("Atenção: Você não marcou 'Compartilhar áudio' na janela. Gravando apenas seu microfone.");
          }

          if (micStream) {
            const micSource = ctx.createMediaStreamSource(micStream);
            micSource.connect(destination);
          }

          finalStream = destination.stream;
          systemStream.getVideoTracks().forEach(track => finalStream.addTrack(track));
        } else {
          throw new Error("Nenhuma fonte de áudio detectada.");
        }
      } else {
        finalStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      streamRef.current = finalStream;
      mediaRecorderRef.current = new MediaRecorder(finalStream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      
      mediaRecorderRef.current.start();
      recognitionRef.current?.start();
      setStatus('recording');
      setTranscript('');
      setResult('');
    } catch (e: any) {
      console.error(e);
      if (e.name === 'NotAllowedError') setError("Permissão negada. Clique em 'Permitir' no navegador.");
      else if (e.message.includes("no audio track")) setError("Erro: Nenhuma trilha de áudio selecionada. Marque 'Compartilhar áudio'.");
      else setError(`Erro: ${e.message || "Falha ao acessar dispositivos"}`);
      setStatus('idle');
    }
  };

  const stopAll = () => {
    try {
      recognitionRef.current?.stop();
      if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
      
      streamRef.current?.getTracks().forEach(t => t.stop());
      extraStreamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
      extraStreamsRef.current = [];

      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    } catch (e) {
      console.warn("Cleanup warning:", e);
    }
    if (status !== 'idle') setStatus('done');
  };

  const togglePauseResume = () => {
    if (status === 'paused') {
      recognitionRef.current?.start();
      mediaRecorderRef.current?.resume();
      setStatus('recording');
    } else {
      recognitionRef.current?.stop();
      mediaRecorderRef.current?.pause();
      setStatus('paused');
    }
  };

  const reset = () => {
    stopAll();
    setStatus('idle');
    setTranscript('');
    setResult('');
    audioChunksRef.current = [];
    setError(null);
  };

  const handleExport = () => {
    if (audioChunksRef.current.length === 0) return;
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `lumina_meeting_${Date.now()}.webm`; a.click();
  };

  const generateAI = async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const res = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: `Analise a transcrição abaixo e gere uma ATA formal de reunião. Inclua participantes, pauta, decisões e ações. Transcrição: ${transcript}` 
      });
      setResult(res.text || '');
    } catch (e) {} finally { setLoading(false); }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 max-w-4xl mx-auto overflow-y-auto custom-scrollbar">
      <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-100 flex flex-col gap-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl text-white shadow-lg transition-all ${status === 'recording' ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'}`}>
            <Mic size={24} />
          </div>
          <h3 className="font-extrabold text-xl text-slate-800">Ata de Reunião</h3>
        </div>
        
        <div className="bg-slate-50 p-6 rounded-3xl min-h-[220px] text-sm text-slate-400 italic border border-slate-100 shadow-inner overflow-y-auto max-h-[400px] leading-relaxed relative flex flex-col items-center justify-center">
          {error ? (
            <div className="flex flex-col items-center justify-center text-rose-500 p-8 text-center bg-rose-50/50 rounded-3xl w-full h-full">
              <AlertCircle size={32} className="mb-3"/>
              <p className="font-bold text-sm mb-4">{error}</p>
              <button onClick={() => startCapturing('system')} className="px-6 py-2 bg-rose-500 text-white rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg">Tentar Novamente</button>
            </div>
          ) : (
            <div className="w-full text-left">
              {transcript || (
                <div className="flex flex-col gap-2 text-center opacity-60">
                  <p>Pronto para capturar sua reunião.</p>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Dica: Selecione 'Capturar System Audio' para gravar chamadas de vídeo.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {status === 'idle' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button onClick={() => startCapturing('mic')} className="bg-indigo-600 text-white p-5 rounded-3xl font-bold flex items-center justify-center gap-3 shadow-xl active:scale-95 hover:bg-indigo-700 transition-all">
                <Mic size={20}/> Gravar Microfone
              </button>
              <button onClick={() => startCapturing('system')} className="bg-slate-800 text-white p-5 rounded-3xl font-bold flex items-center justify-center gap-3 shadow-xl active:scale-95 hover:bg-slate-900 transition-all">
                <Monitor size={20}/> Capturar System Audio
              </button>
            </div>
          )}

          {(status === 'recording' || status === 'paused') && (
            <div className="flex flex-row gap-3 items-center">
              <button onClick={togglePauseResume} className="flex-1 bg-white border-2 border-slate-100 p-5 rounded-3xl font-bold text-indigo-600 flex items-center justify-center gap-3 active:scale-95 shadow-sm hover:bg-slate-50">
                {status === 'paused' ? <Play size={22} className="fill-indigo-600" /> : <Pause size={22} className="fill-indigo-600" />}
                {status === 'paused' ? "Retomar" : "Pausar"}
              </button>
              <button onClick={reset} className="p-5 bg-slate-50 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all border border-slate-100 shadow-sm">
                <Trash2 size={22} />
              </button>
              <button onClick={stopAll} className="flex-[2] bg-rose-500 text-white p-5 rounded-3xl font-bold flex items-center justify-center gap-3 shadow-lg active:scale-95 hover:bg-rose-600 transition-all">
                <StopCircle size={22} /> Parar e Finalizar
              </button>
            </div>
          )}

          {status === 'done' && (
            <div className="flex flex-col md:flex-row gap-3">
              <button onClick={reset} className="flex-1 bg-white border border-slate-200 text-slate-500 p-4 rounded-2xl font-bold active:scale-95">Reiniciar</button>
              <button onClick={handleExport} className="flex-1 bg-white border border-slate-200 text-indigo-600 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 shadow-sm">
                <Download size={18}/> Baixar Áudio
              </button>
              <button onClick={generateAI} disabled={loading} className="flex-[2] bg-indigo-600 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 shadow-lg">
                {loading ? <Loader2 className="animate-spin" size={20}/> : <Sparkles size={20}/>} Gerar Ata IA
              </button>
            </div>
          )}
        </div>
      </div>
      
      {result && (
        <div className="mt-8 bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative group animate-in fade-in slide-in-from-bottom-4">
          <button onClick={() => navigator.clipboard.writeText(result)} className="absolute top-6 right-6 p-2 text-white/30 hover:text-white transition-all"><Copy size={18}/></button>
          <div className="flex items-center gap-2 mb-6 text-indigo-400 font-bold border-b border-indigo-500/20 pb-4">
            <Bot size={20}/>
            <span className="uppercase tracking-widest text-xs">Ata Gerada Pela Lumina</span>
          </div>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{result}</div>
        </div>
      )}
    </div>
  );
};

// --- ChatView ---
const ChatView = ({ isMobile }: { isMobile: boolean }) => {
  const [messages, setMessages] = useState<Message[]>([{ role: 'model', text: 'Olá! Sou Lumina. Como posso ajudar hoje?' }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const txt = input; setInput('');
    setMessages(prev => [...prev, { role: 'user', text: txt }]);
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const res = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: txt });
      setMessages(prev => [...prev, { role: 'model', text: res.text || '' }]);
    } catch (e) {} finally { setIsLoading(false); }
  };
  return (
    <div className="flex flex-col h-full w-full p-4 md:p-6 max-w-4xl mx-auto">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pb-24 md:pb-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`p-4 rounded-3xl shadow-sm text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'}`}>
                <div className="whitespace-pre-wrap">{m.text}</div>
            </div>
          </div>
        ))}
        {isLoading && <Loader2 className="animate-spin text-indigo-400 mx-auto" />}
      </div>
      <div className="absolute bottom-4 left-4 right-4 md:relative md:bottom-0 md:left-0 md:right-0 mt-4 flex items-center gap-2 bg-white rounded-full border border-slate-200 p-1.5 shadow-lg">
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key === 'Enter' && handleSend()} placeholder="Pergunte algo..." className="flex-1 px-4 py-2 outline-none font-medium text-sm bg-transparent" />
        <button onClick={handleSend} className="p-3 bg-indigo-600 text-white rounded-full shadow-md active:scale-90 transition-transform"><Send size={18} /></button>
      </div>
    </div>
  );
};

// --- DocStudioView ---
const DocStudioView = ({ isMobile }: { isMobile: boolean }) => {
  const [content, setContent] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const handleProcess = async (task: string) => {
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const res = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: `Tarefa: ${task}. Instrução: ${content}` });
      setResult(res.text || '');
    } catch (e) {} finally { setIsLoading(false); }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 max-w-6xl mx-auto overflow-y-auto custom-scrollbar">
       <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-6">
          <h3 className="font-bold text-lg">Estúdio Doc</h3>
          <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="O que deseja fazer?" className="min-h-[120px] bg-slate-50 p-4 rounded-2xl outline-none" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
             <DocBtn onClick={()=>handleProcess('excel')} label="Excel" icon={<FileSpreadsheet size={18}/>} color="green" loading={isLoading} />
             <DocBtn onClick={()=>handleProcess('ppt')} label="Slides" icon={<Presentation size={18}/>} color="indigo" loading={isLoading} />
             <DocBtn onClick={()=>handleProcess('resumo')} label="Resumo" icon={<BookOpen size={18}/>} color="slate" loading={isLoading} />
             <DocBtn onClick={()=>handleProcess('manual')} label="Guia" icon={<ClipboardList size={18}/>} color="amber" loading={isLoading} />
          </div>
       </div>
       {result && <div className="mt-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-md whitespace-pre-wrap text-sm">{result}</div>}
    </div>
  );
};

// --- LiveVoiceView (Atualizado com Histórico de Texto e Cópia) ---
const LiveVoiceView = ({ isMobile }: { isMobile: boolean }) => {
  const [active, setActive] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);
  const [isCopied, setIsCopied] = useState<number | null>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const transcriptBufferRef = useRef<{ role: 'user' | 'model', text: string }>({ role: 'user', text: '' });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  const stop = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setActive(false);
    for (const source of sourcesRef.current.values()) {
      source.stop();
    }
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setIsCopied(index);
    setTimeout(() => setIsCopied(null), 2000);
  };

  const start = async () => {
    setHistory([]);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      audioContextRef.current = outCtx;

      sessionPromiseRef.current = ai.live.connect({ 
        model: 'gemini-2.5-flash-native-audio-preview-12-2025', 
        callbacks: { 
          onopen: () => {
            setActive(true);
            navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
              const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 16000});
              const source = inCtx.createMediaStreamSource(stream);
              const scriptProcessor = inCtx.createScriptProcessor(4096, 1, 1);
              scriptProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const l = inputData.length;
                const int16 = new Int16Array(l);
                for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
                const pcmBlob = {
                  data: encode(new Uint8Array(int16.buffer)),
                  mimeType: 'audio/pcm;rate=16000',
                };
                sessionPromiseRef.current?.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              };
              source.connect(scriptProcessor);
              scriptProcessor.connect(inCtx.destination);
            });
          }, 
          onclose: () => setActive(false), 
          onerror: (e) => setActive(false),
          onmessage: async (message: LiveServerMessage) => {
            // Process Transcription
            if (message.serverContent?.outputTranscription) {
                const text = message.serverContent.outputTranscription.text;
                setHistory(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === 'model') {
                    const newHist = [...prev];
                    newHist[newHist.length - 1] = { ...last, text: last.text + text };
                    return newHist;
                  }
                  return [...prev, { role: 'model', text }];
                });
            } else if (message.serverContent?.inputTranscription) {
                const text = message.serverContent.inputTranscription.text;
                setHistory(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === 'user') {
                    const newHist = [...prev];
                    newHist[newHist.length - 1] = { ...last, text: last.text + text };
                    return newHist;
                  }
                  return [...prev, { role: 'user', text }];
                });
            }

            // Process Audio
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              const ctx = audioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          }
        }, 
        config: { 
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {}, // Habilitar transcrição da resposta
          inputAudioTranscription: {}, // Habilitar transcrição do usuário
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
        } 
      });
      sessionRef.current = await sessionPromiseRef.current;
    } catch (e) { setActive(false); }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 max-w-4xl mx-auto overflow-hidden">
      <div className="flex-1 flex flex-col bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden mb-6">
        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-4">
          {history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 opacity-50">
              <Bot size={48} />
              <p className="font-medium">O áudio e o texto aparecerão aqui durante a conversa.</p>
            </div>
          ) : (
            history.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`group relative max-w-[85%] p-4 rounded-3xl text-sm shadow-sm transition-all ${
                  msg.role === 'user' ? 'bg-slate-100 text-slate-700 rounded-tr-none' : 'bg-indigo-600 text-white rounded-tl-none'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                  {msg.role === 'model' && (
                    <button 
                      onClick={() => handleCopy(msg.text, i)} 
                      className="absolute -top-2 -right-2 bg-white text-slate-500 p-1.5 rounded-xl shadow-md border border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity hover:text-indigo-600"
                    >
                      {isCopied === i ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="p-8 border-t border-slate-50 flex flex-col items-center justify-center gap-6 bg-slate-50/30">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${active ? 'bg-indigo-600 shadow-2xl animate-pulse scale-110' : 'bg-white border-4 border-indigo-100'}`}>
            {active ? <Volume2 size={32} className="text-white" /> : <Bot size={32} className="text-indigo-200" />}
          </div>
          <button onClick={active ? stop : start} className={`px-14 py-4 rounded-full font-bold text-lg text-white shadow-xl transition-all active:scale-95 flex items-center gap-3 ${active ? 'bg-rose-500 hover:bg-rose-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            {active ? <StopCircle size={20} /> : <Play size={20} className="fill-current" />}
            {active ? "Encerrar Chamada" : "Conversar Agora"}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- ImageView ---
const ImageView = ({ isMobile }: { isMobile: boolean }) => {
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const gen = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const res = await ai.models.generateContent({ 
        model: 'gemini-2.5-flash-image', 
        contents: { parts: [{ text: prompt }] } 
      });
      const newImgs: any[] = [];
      res.candidates?.[0]?.content?.parts?.forEach((part, index) => { 
        if (part.inlineData) {
          newImgs.push({ id: `${Date.now()}-${index}`, url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` }); 
        } 
      });
      setImages(prev => [...newImgs, ...prev]);
    } catch (e) {} finally { setLoading(false); }
  };
  return (
    <div className="h-full flex flex-col p-4 md:p-6">
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3">
        <input value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>e.key === 'Enter' && gen()} placeholder="O que vamos criar?" className="flex-1 bg-slate-50 px-5 py-3 rounded-2xl outline-none" />
        <button onClick={gen} disabled={loading} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold">{loading ? <Loader2 className="animate-spin"/> : "Gerar"}</button>
      </div>
      <div className="flex-1 overflow-y-auto mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {images.map(img => (
          <div key={img.id} className="aspect-square rounded-2xl overflow-hidden shadow-sm border-2 border-white hover:scale-[1.02] transition-transform">
            <img src={img.url} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
