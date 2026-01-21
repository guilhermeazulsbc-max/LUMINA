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
  Paperclip,
  Copy,
  Check,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Trash2,
  Mic,
  Volume2,
  ArrowRight,
  Presentation,
  BookOpen,
  ClipboardList,
  History,
  X,
  Layers,
  StopCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Table as TableIcon,
  Archive,
  CheckSquare,
  Square,
  Bot
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
type Tab = 'chat' | 'doc' | 'image' | 'live' | 'meeting';
interface AttachedFile { 
  id: string;
  data: string; 
  name: string; 
  type: string; 
  size: number;
  isMedia: boolean; 
}
interface Message { role: 'user' | 'model'; text: string; files?: AttachedFile[]; }
interface GeneratedImage { id: string; url: string; prompt: string; timestamp: number; }
interface LiveTranscript { role: 'user' | 'model'; text: string; }

// --- App Component ---
const App = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  if (!hasStarted) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-1000">
        <div className="mb-8 pulse-soft">
            <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-200">
                <Bot size={52} className="text-white" />
            </div>
        </div>
        <h1 className="text-6xl font-extrabold text-slate-800 tracking-tighter mb-12">Lumina</h1>
        
        <button 
          onClick={() => setHasStarted(true)}
          className="group relative flex items-center gap-4 bg-indigo-600 hover:bg-indigo-700 text-white px-14 py-6 rounded-full font-bold text-xl transition-all shadow-xl shadow-indigo-100 hover:shadow-indigo-300 hover:-translate-y-1 active:scale-95 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] transition-transform" />
          Comece Aqui
          <ArrowRight className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-700 overflow-hidden animate-in slide-in-from-bottom-4 duration-700">
      <aside 
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
        className={`${isSidebarExpanded ? 'w-64' : 'w-20'} transition-all duration-300 soft-glass border-r border-slate-200 flex flex-col z-20 group`}
      >
        <div 
          onClick={() => setHasStarted(false)}
          className="p-6 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
        >
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-100 flex-shrink-0 transition-transform active:scale-90 hover:scale-105">
            <Bot size={18} className="text-white" />
          </div>
          <span className={`font-bold text-xl tracking-tight text-slate-800 transition-opacity duration-200 whitespace-nowrap ${isSidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>
            Lumina
          </span>
        </div>

        <nav className="flex-1 px-3 space-y-2 mt-4 overflow-hidden">
          <NavButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare size={20} />} label="Chat Inteligente" collapsed={!isSidebarExpanded} />
          <NavButton active={activeTab === 'meeting'} onClick={() => setActiveTab('meeting')} icon={<ClipboardList size={20} />} label="Ata de Reunião" collapsed={!isSidebarExpanded} />
          <NavButton active={activeTab === 'doc'} onClick={() => setActiveTab('doc')} icon={<FileText size={20} />} label="Estúdio Doc" collapsed={!isSidebarExpanded} />
          <NavButton active={activeTab === 'live'} onClick={() => setActiveTab('live')} icon={<Mic size={20} />} label="Voz Live" collapsed={!isSidebarExpanded} />
          <NavButton active={activeTab === 'image'} onClick={() => setActiveTab('image')} icon={<ImageIcon size={20} />} label="Imagens AI" collapsed={!isSidebarExpanded} />
        </nav>

        <div className="p-4 border-t border-slate-100 overflow-hidden">
           <div className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 cursor-pointer">
             <div className="flex-shrink-0"><Settings size={20} /></div>
             <span className={`font-medium transition-opacity duration-200 whitespace-nowrap ${isSidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>
               Configurações
             </span>
           </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div className={`flex-1 overflow-hidden h-full ${activeTab === 'chat' ? 'block' : 'hidden'}`}>
          <ChatView />
        </div>
        <div className={`flex-1 overflow-hidden h-full ${activeTab === 'meeting' ? 'block' : 'hidden'}`}>
          <MeetingView />
        </div>
        <div className={`flex-1 overflow-hidden h-full ${activeTab === 'doc' ? 'block' : 'hidden'}`}>
          <DocStudioView />
        </div>
        <div className={`flex-1 overflow-hidden h-full ${activeTab === 'live' ? 'block' : 'hidden'}`}>
          <LiveVoiceView />
        </div>
        <div className={`flex-1 overflow-hidden h-full ${activeTab === 'image' ? 'block' : 'hidden'}`}>
          <ImageView />
        </div>
      </main>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label, collapsed }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, collapsed: boolean }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-200 ${
      active 
        ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
        : 'text-slate-400 hover:bg-white hover:text-slate-600'
    }`}
  >
    <div className={`flex-shrink-0 ${active ? 'text-indigo-600' : ''}`}>{icon}</div>
    <span className={`font-semibold transition-opacity duration-200 whitespace-nowrap ${!collapsed ? 'opacity-100' : 'opacity-0'}`}>
      {label}
    </span>
  </button>
);

const FileChips = ({ files, onRemove }: { files: AttachedFile[], onRemove: (id: string) => void }) => (
  <div className="flex flex-wrap gap-2 px-4 py-2 bg-slate-50/50 border-b border-slate-100">
    {files.map(file => (
      <div key={file.id} className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-[10px] font-bold text-slate-600 shadow-sm group">
        <div className="text-indigo-500">
          {file.type.includes('pdf') ? <FileText size={14} /> : <FileText size={14} />}
        </div>
        <span className="max-w-[150px] truncate">{file.name}</span>
        <button onClick={() => onRemove(file.id)} className="text-slate-300 hover:text-rose-500 transition-colors ml-1">
          <X size={14} />
        </button>
      </div>
    ))}
  </div>
);

// --- DocStudioView ---
const DocStudioView = () => {
  const [content, setContent] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentTask, setCurrentTask] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    for (const file of files) {
      const id = Math.random().toString(36).substring(7);
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onloadend = () => setAttachedFiles(prev => [...prev, { id, data: (reader.result as string).split(',')[1], name: file.name, type: file.type, size: file.size, isMedia: true }]);
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (evt) => setAttachedFiles(prev => [...prev, { id, data: evt.target?.result as string, name: file.name, type: file.type || 'text/plain', size: file.size, isMedia: false }]);
        reader.readAsText(file);
      }
    }
  };

  const processDoc = async (task: 'excel' | 'ppt' | 'resumo' | 'manual') => {
    if (isLoading || (!content.trim() && attachedFiles.length === 0)) return;
    setIsLoading(true);
    setCurrentTask(task);
    setResult('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let systemInstruction = "";
      let responseMimeType = "text/plain";
      let responseSchema: any = undefined;

      switch(task) {
        case 'excel':
          systemInstruction = "Extraia dados tabulares dos arquivos e retorne um JSON contendo uma lista de linhas (cada linha é uma lista de strings).";
          responseMimeType = "application/json";
          responseSchema = {
            type: Type.OBJECT,
            properties: {
              table: {
                type: Type.ARRAY,
                items: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          };
          break;
        case 'ppt':
          systemInstruction = "Analise o conteúdo e crie uma estrutura de slides para PowerPoint em JSON. Cada slide deve ter um título e uma lista de tópicos.";
          responseMimeType = "application/json";
          responseSchema = {
            type: Type.OBJECT,
            properties: {
              slides: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    bullets: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
                }
              }
            }
          };
          break;
        case 'resumo':
          systemInstruction = "Gere um resumo executivo profissional do conteúdo fornecido, destacando pontos-chave.";
          break;
        case 'manual':
          systemInstruction = "Transforme o conteúdo em um guia passo a passo detalhado (Manual de Instruções).";
          break;
      }

      const parts: any[] = [{ text: `DADOS ADICIONAIS: ${content}` }];
      attachedFiles.forEach(f => {
        if (f.isMedia) parts.push({ inlineData: { data: f.data, mimeType: f.type } });
        else parts.push({ text: `ARQUIVO ${f.name}: ${f.data}` });
      });

      const response = await ai.models.generateContent({ 
        model: 'gemini-3-pro-preview', 
        contents: { parts },
        config: { systemInstruction, responseMimeType, responseSchema }
      });

      const output = response.text || '';
      
      if (task === 'excel') {
        const json = JSON.parse(output);
        const ws = XLSX.utils.aoa_to_sheet(json.table);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Dados Extraídos");
        XLSX.writeFile(wb, `lumina_extração_${Date.now()}.xlsx`);
        setResult("Tabela Excel gerada e baixada com sucesso!");
      } else if (task === 'ppt') {
        const json = JSON.parse(output);
        const pres = new pptxgen();
        json.slides.forEach((s: any) => {
          const slide = pres.addSlide();
          slide.addText(s.title, { x: 0.5, y: 0.5, w: 9, h: 1, fontSize: 32, bold: true, color: '363636' });
          slide.addText(s.bullets.join('\n'), { x: 0.5, y: 1.5, w: 9, h: 4, fontSize: 18, color: '666666' });
        });
        pres.writeFile({ fileName: `lumina_apresentação_${Date.now()}.pptx` });
        setResult("Apresentação PowerPoint gerada e baixada com sucesso!");
      } else {
        setResult(output);
      }

    } catch (e) { 
      console.error(e); 
      setResult("Erro ao processar documentos.");
    } finally { 
      setIsLoading(false); 
      setCurrentTask(null);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 max-w-6xl mx-auto w-full overflow-hidden">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-6 flex-1 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100"><Layers size={24}/></div>
            <div>
              <h3 className="text-2xl font-bold text-slate-800 tracking-tighter">Estúdio Doc</h3>
              <p className="text-slate-400 text-xs font-medium">Automatize a conversão de seus arquivos.</p>
            </div>
          </div>
          <button onClick={() => document.getElementById('doc-up')?.click()} className="px-5 py-2.5 rounded-2xl border border-indigo-100 text-indigo-600 hover:bg-indigo-50 font-bold text-sm transition-all flex items-center gap-2">
            <Plus size={16} /> Anexar Arquivos
          </button>
          <input id="doc-up" type="file" multiple className="hidden" onChange={handleFileUpload} />
        </div>
        
        {attachedFiles.length > 0 && <FileChips files={attachedFiles} onRemove={(id) => setAttachedFiles(p => p.filter(f => f.id !== id))} />}
        
        <textarea 
          value={content} 
          onChange={(e) => setContent(e.target.value)} 
          placeholder="Diga à Lumina o que fazer com estes arquivos..." 
          className="flex-1 bg-slate-50 p-6 rounded-[2rem] outline-none font-medium text-slate-700 resize-none shadow-inner border border-transparent focus:border-indigo-100 transition-all custom-scrollbar" 
        />
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DocButton onClick={() => processDoc('excel')} label="Para Excel" icon={<FileSpreadsheet size={20}/>} loading={isLoading && currentTask === 'excel'} color="green" />
          <DocButton onClick={() => processDoc('ppt')} label="Para Slide" icon={<Presentation size={20}/>} loading={isLoading && currentTask === 'ppt'} color="indigo" />
          <DocButton onClick={() => processDoc('resumo')} label="Resumir" icon={<BookOpen size={20}/>} loading={isLoading && currentTask === 'resumo'} color="slate" />
          <DocButton onClick={() => processDoc('manual')} label="Manual" icon={<ClipboardList size={20}/>} loading={isLoading && currentTask === 'manual'} color="amber" />
        </div>
      </div>
      
      {result && (
        <div className="mt-6 bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 overflow-y-auto max-h-[40vh] animate-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-slate-800 flex items-center gap-2"><Sparkles size={18} className="text-indigo-600"/> Resultado Gerado</h4>
            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(result)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Copy size={18}/></button>
              <button onClick={() => setResult('')} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={18}/></button>
            </div>
          </div>
          <div className="text-sm leading-relaxed text-slate-600 font-medium whitespace-pre-wrap">{result}</div>
        </div>
      )}
    </div>
  );
};

const DocButton = ({ onClick, label, icon, loading, color }: any) => {
  const colors = {
    green: "bg-green-50 text-green-700 border-green-100 hover:bg-green-600",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-600",
    slate: "bg-slate-50 text-slate-700 border-slate-100 hover:bg-slate-600",
    amber: "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-600"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={loading}
      className={`p-4 rounded-[1.5rem] border font-bold flex flex-col items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 group ${colors[color as keyof typeof colors]}`}
    >
      <div className={`transition-colors group-hover:text-white`}>
        {loading ? <Loader2 className="animate-spin" /> : icon}
      </div>
      <span className="group-hover:text-white transition-colors">{label}</span>
    </button>
  );
};

// --- MeetingView ---
const MeetingView = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [ataResult, setAtaResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'pt-BR';

      recognitionRef.current.onresult = (event: any) => {
        let current = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) current += event.results[i][0].transcript + ' ';
        }
        setTranscript(prev => prev + current);
      };
      recognitionRef.current.onerror = () => setIsRecording(false);
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) return alert("Navegador não suportado.");
    if (isRecording) {
      recognitionRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
    } else {
      setAtaResult('');
      setTimer(0);
      recognitionRef.current.start();
      setIsRecording(true);
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    }
  };

  const generateAta = async () => {
    if (!transcript.trim()) return;
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Aja como secretário executivo. Gere uma ATA profissional separada por PRINCIPAIS ASSUNTOS, DECISÕES e TAREFAS a partir da transcrição: ${transcript}`;
      const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt });
      setAtaResult(response.text || '');
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  return (
    <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full overflow-hidden">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-6 flex-1 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className={`p-3 rounded-2xl shadow-lg transition-all ${isRecording ? 'bg-rose-500 animate-pulse' : 'bg-indigo-600'}`}>
                {isRecording ? <StopCircle className="text-white" size={24}/> : <ClipboardList className="text-white" size={24}/>}
             </div>
             <div><h3 className="text-2xl font-bold text-slate-800">Assistente de Reunião</h3></div>
          </div>
          {isRecording && <div className="px-4 py-2 bg-rose-50 rounded-full text-rose-600 font-bold text-sm">{Math.floor(timer/60)}:{(timer%60).toString().padStart(2,'0')}</div>}
        </div>
        <div className="flex-1 bg-slate-50 rounded-[2rem] p-6 overflow-y-auto custom-scrollbar border border-slate-100 shadow-inner">
          <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{transcript || "Clique em iniciar para gravar..."}</p>
        </div>
        <div className="flex gap-4">
          <button onClick={toggleRecording} className={`flex-1 py-5 rounded-[2rem] font-bold text-lg transition-all shadow-xl ${isRecording ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
            {isRecording ? "Parar Reunião" : "Gravar Reunião"}
          </button>
          {!isRecording && transcript && (
            <button onClick={generateAta} disabled={isLoading} className="flex-1 bg-white border border-slate-200 py-5 rounded-[2rem] font-bold text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="animate-spin"/> : <Sparkles className="text-indigo-600"/>} Gerar ATA
            </button>
          )}
        </div>
      </div>
      {ataResult && (
        <div className="mt-6 bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl flex flex-col gap-4 max-h-[50vh] overflow-y-auto">
          <div className="flex justify-between items-center text-white"><h4 className="font-bold">ATA Estruturada</h4><button onClick={() => setAtaResult('')} className="p-2 hover:bg-white/10 rounded-lg"><Trash2 size={18}/></button></div>
          <div className="text-indigo-50 leading-relaxed text-sm whitespace-pre-wrap">{ataResult}</div>
        </div>
      )}
    </div>
  );
};

// --- ChatView ---
const ChatView = () => {
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
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full p-6">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pb-4 pr-2">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-6 rounded-[2.5rem] shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'}`}>
                <p className="text-sm leading-relaxed">{m.text}</p>
            </div>
          </div>
        ))}
        {isLoading && <Loader2 className="animate-spin text-indigo-400 mx-auto" />}
      </div>
      <div className="mt-6 flex items-center gap-2 bg-white rounded-full border border-slate-100 p-2 shadow-2xl">
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key === 'Enter' && handleSend()} placeholder="Pergunte algo..." className="flex-1 px-6 outline-none font-medium" />
        <button onClick={handleSend} className="p-4 bg-indigo-600 text-white rounded-full shadow-lg"><Send size={20} /></button>
      </div>
    </div>
  );
};

// --- LiveVoiceView ---
const LiveVoiceView = () => {
  const [isActive, setIsActive] = useState(false);
  const sessionRef = useRef<any>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const start = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      outputCtxRef.current = new AudioContext({ sampleRate: 24000 });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsActive(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              sessionPromise.then(s => s.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(scriptProcessor); scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputCtxRef.current) {
              const buf = await decodeAudioData(decode(base64Audio), outputCtxRef.current, 24000, 1);
              const src = outputCtxRef.current.createBufferSource();
              src.buffer = buf; src.connect(outputCtxRef.current.destination);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtxRef.current.currentTime);
              src.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buf.duration;
              sourcesRef.current.add(src);
            }
          },
          onclose: () => setIsActive(false),
          onerror: () => setIsActive(false),
        },
        config: { responseModalities: [Modality.AUDIO] }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { console.error(e); }
  };

  const stop = () => { if (sessionRef.current) sessionRef.current.close(); setIsActive(false); };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6">
      <div className={`w-40 h-40 rounded-full flex items-center justify-center border-8 transition-all ${isActive ? 'bg-indigo-600 border-indigo-100 scale-110 shadow-2xl' : 'bg-slate-100 border-slate-200'}`}>
        {isActive ? <Volume2 size={64} className="text-white animate-pulse" /> : <Bot size={64} className="text-slate-300"/>}
      </div>
      <button onClick={isActive ? stop : start} className={`mt-12 px-16 py-6 rounded-full font-bold text-xl shadow-xl transition-all ${isActive ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white'}`}>
        {isActive ? "Parar Voz Live" : "Iniciar Voz Live"}
      </button>
    </div>
  );
};

// --- ImageView ---
const ImageView = () => {
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const finalPrompt = `Generate 4 distinct, high-quality visual variations of: ${prompt}. Each image should explore a slightly different style or angle.`;
      const res = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts: [{ text: finalPrompt }] } });
      const newImgs: GeneratedImage[] = [];
      res.candidates?.[0]?.content?.parts?.forEach(p => { 
        if(p.inlineData) {
          newImgs.push({ id: Math.random().toString(36).substr(2, 9), url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`, prompt: prompt, timestamp: Date.now() }); 
        }
      });
      setImages(prev => [...newImgs, ...prev]);
    } catch (e) { console.error(e); } finally { setIsGenerating(false); }
  };

  const downloadSelectedAsZip = async () => {
    if (selectedIds.size === 0) return;
    const zip = new JSZip();
    const folder = zip.folder("lumina-generations");
    images.filter(img => selectedIds.has(img.id)).forEach((img, idx) => {
      folder?.file(`image-${idx + 1}-${img.id}.png`, img.url.split(',')[1], { base64: true });
    });
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lumina-pack-${Date.now()}.zip`;
    link.click();
  };

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full overflow-hidden">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm mb-6 space-y-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1"><span className="text-[10px] font-bold text-slate-300 uppercase block mb-2 px-1 tracking-widest">Geração Visual</span>
            <input value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()} placeholder="Descreva o que deseja criar..." className="w-full bg-slate-50 p-5 rounded-[1.5rem] outline-none font-medium shadow-inner" />
          </div>
          <button onClick={generate} disabled={isGenerating || !prompt.trim()} className="h-[64px] px-10 bg-indigo-600 text-white rounded-[1.5rem] font-bold flex items-center gap-3 shadow-xl disabled:opacity-50">
            {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />} Gerar
          </button>
        </div>
      </div>
      {images.length > 0 && (
        <div className="flex justify-between mb-4">
          <button onClick={() => setSelectedIds(new Set(images.map(i => i.id)))} className="text-xs font-bold text-slate-400 uppercase">Selecionar Tudo</button>
          <button onClick={downloadSelectedAsZip} disabled={selectedIds.size === 0} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-2"><Archive size={16}/> Baixar ZIP</button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-4 gap-6 custom-scrollbar">
        {images.map(img => (
          <div key={img.id} onClick={() => { const next = new Set(selectedIds); if(next.has(img.id)) next.delete(img.id); else next.add(img.id); setSelectedIds(next); }} className={`group relative aspect-square rounded-[2rem] overflow-hidden border-2 cursor-pointer transition-all ${selectedIds.has(img.id) ? 'border-indigo-500 scale-95 shadow-xl' : 'border-slate-100'}`}>
            <img src={img.url} className="w-full h-full object-cover" />
            {selectedIds.has(img.id) && <div className="absolute top-4 right-4 bg-indigo-600 text-white p-1 rounded-full"><Check size={16}/></div>}
          </div>
        ))}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);