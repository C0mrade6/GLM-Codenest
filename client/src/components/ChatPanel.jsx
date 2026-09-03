import { useEffect, useRef, useState } from 'react';

export default function ChatPanel({ messages, onSend, disabled, disabledNote, me }) {
  const [text, setText] = useState('');
  const [warn, setWarn] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    if (disabled) {
      setWarn(disabledNote || 'Chat is disabled right now.');
      setTimeout(() => setWarn(''), 2500);
      return;
    }
    onSend(t);
    setText('');
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-nest-700 shrink-0">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-300">💬 Team Chat</span>
        {disabled && <span className="badge bg-amber-950/70 text-amber-300 border border-amber-800">🔒 Learning Mode</span>}
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {messages.length === 0 && <p className="text-xs text-slate-600 text-center mt-4">No messages yet — say hi to your team!</p>}
        {messages.map((m, i) => (
          <div key={i} className={`text-sm ${m.system ? 'text-center' : ''}`}>
            {m.system ? (
              <span className="text-[11px] text-indigo-300/70 italic">{m.text}</span>
            ) : (
              <>
                <span className={`font-bold ${m.sid === me ? 'text-emerald-400' : 'text-indigo-300'}`}>{m.name}: </span>
                <span className="text-slate-300 break-words">{m.text}</span>
              </>
            )}
          </div>
        ))}
      </div>
      {warn && <p className="px-3 pb-1 text-[11px] text-amber-400">{warn}</p>}
      <div className="p-2 border-t border-nest-700 flex gap-2 shrink-0">
        <input
          className="input py-1.5 text-sm"
          placeholder={disabled ? 'Chat disabled — focus on the task!' : 'Message your team…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          maxLength={500}
        />
        <button className="btn-primary px-3 py-1.5" onClick={send} disabled={disabled}>➤</button>
      </div>
    </div>
  );
}
