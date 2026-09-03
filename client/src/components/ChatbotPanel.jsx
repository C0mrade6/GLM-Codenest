import { useEffect, useRef, useState } from 'react';

const QUICK = ['Explain my code', 'Find bugs in my solution', 'How can I optimize this?'];

export default function ChatbotPanel({ roomCode, activeFile, hintsOn, onToggleHints, hints, onHintClick, aiDisabled }) {
  const [messages, setMessages] = useState([]); // {role:'user'|'ai', text}
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const ask = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, message: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI unavailable');
      setMessages((m) => [...m, { role: 'ai', text: data.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'ai', text: `⚠️ ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-nest-700 shrink-0">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-300">🤖 RAG Chatbot</span>
        <button
          className={`badge border transition ${hintsOn ? 'bg-indigo-950 text-indigo-300 border-indigo-600' : 'bg-nest-800 text-slate-400 border-nest-600'}`}
          onClick={onToggleHints}
          title="Inline AI hints in the editor"
        >
          AI Hints {hintsOn ? 'ON' : 'OFF'}
        </button>
      </div>

      {hintsOn && hints.length > 0 && (
        <div className="px-3 py-2 border-b border-nest-700 bg-indigo-950/20 space-y-1 shrink-0 max-h-36 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-300">Inline hints — {activeFile?.name}</p>
          {hints.map((h, i) => (
            <button key={i} className="block w-full text-left text-xs text-slate-300 hover:text-white" onClick={() => onHintClick(h.line)}>
              <span className="font-mono text-indigo-300">Line {h.line}:</span> {h.hint}
            </button>
          ))}
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-xs text-slate-500 space-y-1 mt-2">
            <p className="text-slate-400 font-semibold">Your AI tutor knows your team's code.</p>
            {QUICK.map((q) => (
              <button key={q} className="block w-full text-left bg-nest-800 hover:bg-nest-700 border border-nest-600 rounded-lg px-2.5 py-1.5 text-slate-300" onClick={() => ask(q)} disabled={aiDisabled}>
                {q}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`text-sm rounded-lg px-2.5 py-2 ${m.role === 'user' ? 'bg-emerald-950/40 text-emerald-100 ml-6' : 'bg-nest-800/70 text-slate-200 mr-4'} whitespace-pre-wrap break-words`}>
            {m.text}
          </div>
        ))}
        {busy && <div className="text-xs text-indigo-300 live-dot">🤖 thinking…</div>}
      </div>

      <div className="p-2 border-t border-nest-700 flex gap-2 shrink-0">
        <input
          className="input py-1.5 text-sm"
          placeholder="Ask AI about your code…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          maxLength={800}
        />
        <button className="btn-primary px-3 py-1.5" onClick={() => ask()} disabled={busy}>➤</button>
      </div>
    </div>
  );
}
