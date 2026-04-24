"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, RefreshCw, Download, Settings } from "lucide-react";

type TranscriptItem = { timestamp: string; text: string };
type Suggestion = { type: string; preview: string; expansion_prompt: string };
type ChatMessage = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(true);
  
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[][]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const startRecording = async () => {
    if (!apiKey) return alert("Please set your Groq API Key first.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = [];
        await processAudioChunk(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

      // Chunk every 30 seconds
      recordingIntervalRef.current = setInterval(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.start();
        }
      }, 30000);
    } catch (err) {
      console.error("Error accessing mic:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    setIsRecording(false);
  };

  const processAudioChunk = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append("file", audioBlob, "chunk.webm");
    formData.append("apiKey", apiKey);

    try {
      // 1. Transcribe
      const transRes = await fetch("/api/transcribe", { method: "POST", body: formData });
      const { text } = await transRes.json();
      if (!text) return;

      const newTranscript = { timestamp: new Date().toLocaleTimeString(), text };
      setTranscript((prev) => {
        const updated = [...prev, newTranscript];
        // 2. Generate Suggestions immediately after new transcript
        generateSuggestions(updated);
        return updated;
      });
    } catch (err) {
      console.error("Transcription error:", err);
    }
  };

  const generateSuggestions = async (currentTranscript: TranscriptItem[]) => {
    const context = currentTranscript.slice(-10).map(t => t.text).join(" ");
    if (!context) return;

    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, apiKey }),
      });
      const data = await res.json();
      if (data.suggestions) {
        setSuggestions((prev) => [data.suggestions, ...prev]);
      }
    } catch (err) {
      console.error("Suggestion error:", err);
    }
  };

  const handleSuggestionClick = async (suggestion: Suggestion) => {
    const userMsg = { role: "user" as const, content: suggestion.preview };
    setChat((prev) => [...prev, userMsg]);
    
    const context = transcript.map(t => t.text).join(" ");
    const prompt = `Context from transcript: ${context}\n\nTask: ${suggestion.expansion_prompt}`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, apiKey }),
      });
      const { answer } = await res.json();
      setChat((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch (err) {
      console.error("Chat error:", err);
    }
  };

  const exportSession = () => {
    const sessionData = { transcript, suggestions, chat };
    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `twinmind-session-${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-gray-900">
      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h2 className="text-xl font-bold mb-4">Settings</h2>
            <label className="block text-sm font-medium mb-2">Groq API Key</label>
            <input 
              type="password" 
              className="w-full border p-2 rounded mb-4" 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)} 
              placeholder="gsk_..."
            />
            <button 
              className="w-full bg-blue-600 text-white p-2 rounded"
              onClick={() => setShowSettings(false)}
            >
              Save & Start
            </button>
          </div>
        </div>
      )}

      {/* Column 1: Transcript */}
      <div className="w-1/3 border-r flex flex-col bg-white">
        <div className="p-4 border-b flex justify-between items-center bg-gray-100">
          <h2 className="font-semibold text-lg">Transcript</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-gray-200 rounded">
              <Settings size={18} />
            </button>
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-2 rounded flex items-center gap-2 ${isRecording ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}
            >
              {isRecording ? <Square size={18} /> : <Mic size={18} />}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {transcript.map((t, i) => (
            <div key={i} className="text-sm">
              <span className="text-gray-400 text-xs mr-2">{t.timestamp}</span>
              {t.text}
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      {/* Column 2: Live Suggestions */}
      <div className="w-1/3 border-r flex flex-col bg-gray-50">
        <div className="p-4 border-b flex justify-between items-center bg-gray-100">
          <h2 className="font-semibold text-lg">Live Suggestions</h2>
          <button onClick={() => generateSuggestions(transcript)} className="p-2 hover:bg-gray-200 rounded">
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {suggestions.map((batch, batchIdx) => (
            <div key={batchIdx} className="space-y-3">
              <div className="text-xs text-gray-400 border-b pb-1">Batch {suggestions.length - batchIdx}</div>
              {batch.map((s, i) => (
                <div 
                  key={i} 
                  onClick={() => handleSuggestionClick(s)}
                  className="bg-white p-3 rounded-lg shadow-sm border hover:border-blue-500 cursor-pointer transition"
                >
                  <span className="text-xs font-bold uppercase text-blue-600 tracking-wider">{s.type}</span>
                  <p className="mt-1 text-sm">{s.preview}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Column 3: Chat */}
      <div className="w-1/3 flex flex-col bg-white">
        <div className="p-4 border-b flex justify-between items-center bg-gray-100">
          <h2 className="font-semibold text-lg">Chat & Details</h2>
          <button onClick={exportSession} className="p-2 hover:bg-gray-200 rounded text-sm flex items-center gap-1">
            <Download size={16} /> Export
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chat.map((m, i) => (
            <div key={i} className={`p-3 rounded-lg max-w-[85%] text-sm ${m.role === 'user' ? 'bg-blue-100 ml-auto' : 'bg-gray-100'}`}>
              {m.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}