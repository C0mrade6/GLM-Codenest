import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import FileTabs from '../components/FileTabs.jsx';
import CodeEditor from '../components/CodeEditor.jsx';
import ConsolePanel from '../components/ConsolePanel.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import ChatbotPanel from '../components/ChatbotPanel.jsx';
import LearningPanel from '../components/LearningPanel.jsx';
import VoicePanel from '../components/VoicePanel.jsx';
import { usePyodide } from '../hooks/usePyodide.js';
import { useVoice } from '../hooks/useVoice.js';

const AVATAR_COLORS = ['bg-indigo-600', 'bg-emerald-600', 'bg-purple-600'];

export default function Room() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name] = useState(() => localStorage.getItem('codenest:name') || '');

  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [files, setFiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [chat, setChat] = useState([]);
  const [mode, setMode] = useState('practice');
  const [learning, setLearning] = useState(null); // {task, startedAt, endsAt, submitted}
  const [result, setResult] = useState(null); // last evaluation result (modal)
  const [resultBadge, setResultBadge] = useState(null); // persistent Team Score badge
  const [evaluating, setEvaluating] = useState(false);
  const [endsAt, setEndsAt] = useState(null);
  const [createdAt, setCreatedAt] = useState(null);
  const [remoteCursors, setRemoteCursors] = useState([]); // [{socketId, name, line, fileId}]
  const [hints, setHints] = useState([]);
  const [hintsOn, setHintsOn] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [toast, setToast] = useState('');
  const [fatal, setFatal] = useState(null); // {title, msg}
  const [myId, setMyId] = useState(null);
  const [tick, setTick] = useState(Date.now());

  const socketRef = useRef(null);
  const editorRef = useRef(null);
  const activeIdRef = useRef(null);
  const filesRef = useRef([]);
  const syncTimer = useRef(null);
  const cursorTimer = useRef(null);
  const hintsTimer = useRef(null);
  const lastHintAt = useRef(0);
  const codeCache = useRef({}); // fileId -> content we last emitted

  const py = usePyodide();
  const me = participants.find((p) => p.socketId === myId);
  const isAdmin = !!me?.isAdmin;
  const activeFile = files.find((f) => f.id === activeId) || files[0];

  const showToast = (t) => { setToast(t); setTimeout(() => setToast(''), 3000); };

  // clock for countdowns
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ---- socket lifecycle ----
  useEffect(() => {
    if (!name) return;
    const socket = io(import.meta.env.VITE_SOCKET_URL || '/', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.emit('room:join', { code, name, userId: user?.id || null }, (res) => {
      if (!res.ok) { setJoinError(res.error); return; }
      setMyId(res.you);
      setFiles(res.state.files);
      filesRef.current = res.state.files;
      codeCache.current = Object.fromEntries(res.state.files.map((f) => [f.id, f.content]));
      setActiveId(res.state.files[0]?.id || null);
      setParticipants(res.state.participants);
      setMode(res.state.mode);
      setLearning(res.state.learning);
      setEndsAt(res.state.endsAt);
      setCreatedAt(res.state.createdAt);
      if (res.state.learning?.result) setResultBadge(res.state.learning.result);
      setJoined(true);
    });

    socket.on('room:participants', (ps) => {
      setParticipants(ps);
    });
    socket.on('chat:history', (msgs) => setChat(msgs || []));
    socket.on('chat:message', (m) => setChat((c) => [...c, m]));
    socket.on('code:changed', ({ fileId, content, version, by }) => {
      if (by === socket.id) return;
      setFiles((fs) => fs.map((f) => (f.id === fileId ? { ...f, content, version } : f)));
      filesRef.current = filesRef.current.map((f) => (f.id === fileId ? { ...f, content, version } : f));
    });
    socket.on('files:changed', ({ files: newFiles, activeId: newActive, by }) => {
      setFiles(newFiles);
      filesRef.current = newFiles;
      codeCache.current = Object.fromEntries(newFiles.map((f) => [f.id, f.content]));
      if (newActive) setActiveId(newActive);
      else if (!newFiles.some((f) => f.id === activeIdRef.current)) setActiveId(newFiles[0]?.id || null);
      if (by === socket.id) setActiveId(newActive || newFiles[newFiles.length - 1]?.id);
    });
    socket.on('cursor:updated', ({ fileId, line, socketId, name: who }) => {
      if (socketId === socket.id) return;
      setRemoteCursors((rc) => {
        const next = rc.filter((c) => c.socketId !== socketId);
        next.push({ socketId, name: who, line, fileId });
        return next;
      });
    });
    socket.on('learning:started', (l) => {
      setMode('learning');
      setLearning(l);
      setResult(null);
      setResultBadge(null);
      setHints([]);
      setShowStartModal(false);
    });
    socket.on('learning:evaluating', () => { setEvaluating(true); setLearning((x) => x && { ...x, submitted: true }); });
    socket.on('learning:result', ({ result: r }) => {
      setEvaluating(false);
      setMode('practice');
      setResult(r);
      setResultBadge(r);
      setLearning((x) => x && { ...x, submitted: true });
    });
    socket.on('room:expired', () => setFatal({ title: 'Session expired', msg: 'The 60-minute session limit was reached. Create a new room to keep coding!' }));
    socket.on('room:ended', ({ by }) => setFatal({ title: 'Session ended', msg: `${by} ended this session.` }));
    socket.on('room:kicked', ({ by }) => setFatal({ title: 'Removed from room', msg: `${by} removed you from this session.` }));

    const onBeforeUnload = () => { socket.emit('room:leave'); };
    window.addEventListener('beforeunload', onBeforeUnload);

    // If the connection drops and reconnects, do a clean reload so we
    // re-join with a fresh session (voice peers, cursors, etc.).
    socket.io.on('reconnect', () => window.location.reload());

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      socket.emit('room:leave');
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, name]);

  // ---- voice (needs socket ready) ----
  const voice = useVoice(socketRef, joined, me?.joinedAt);
  useEffect(() => { voice.setContext(myId, participants); }, [myId, participants, voice]);

  // ---- code editing sync ----
  const onLocalChange = useCallback((value) => {
    const fid = activeIdRef.current;
    if (!fid) return;
    setFiles((fs) => fs.map((f) => (f.id === fid ? { ...f, content: value } : f)));
    filesRef.current = filesRef.current.map((f) => (f.id === fid ? { ...f, content: value } : f));
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const f = filesRef.current.find((x) => x.id === fid);
      if (!f || codeCache.current[fid] === f.content) return;
      codeCache.current[fid] = f.content;
      socketRef.current?.emit('code:change', { fileId: fid, content: f.content });
    }, 250);

    if (hintsOn) {
      if (hintsTimer.current) clearTimeout(hintsTimer.current);
      hintsTimer.current = setTimeout(() => maybeFetchHints(fid), 5000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintsOn]);

  const maybeFetchHints = async (fid) => {
    const now = Date.now();
    if (now - lastHintAt.current < 9000) return;
    const f = filesRef.current.find((x) => x.id === fid);
    if (!f || !f.content.trim()) return;
    lastHintAt.current = now;
    try {
      const data = await api('/api/ai/hints', { method: 'POST', body: { roomCode: code, fileId: fid } });
      if (fid === activeIdRef.current) setHints(data.hints || []);
    } catch { /* silent */ }
  };

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  const onCursor = useCallback((line) => {
    if (cursorTimer.current) return;
    cursorTimer.current = setTimeout(() => {
      cursorTimer.current = null;
      socketRef.current?.emit('cursor:update', { fileId: activeIdRef.current, line });
    }, 180);
  }, []);

  // ---- actions ----
  const sendChat = (text) => socketRef.current?.emit('chat:send', { text }, (res) => { if (!res?.ok) showToast(res?.error || 'Message blocked'); });
  const createFile = (n) => socketRef.current?.emit('file:create', { name: n }, (res) => !res?.ok && showToast(res?.error));
  const renameFile = (fid, n) => socketRef.current?.emit('file:rename', { fileId: fid, name: n }, (res) => !res?.ok && showToast(res?.error));
  const deleteFile = (fid) => socketRef.current?.emit('file:delete', { fileId: fid }, (res) => !res?.ok && showToast(res?.error));
  const toggleHints = () => {
    const next = !hintsOn;
    setHintsOn(next);
    if (next && activeId) maybeFetchHints(activeId);
    if (!next) setHints([]);
  };
  const submitSolution = () => {
    if (!window.confirm('Submit the team solution for AI evaluation?')) return;
    setEvaluating(true);
    socketRef.current?.emit('learning:submit', {}, (res) => {
      if (!res?.ok) { setEvaluating(false); showToast(res?.error || 'Submit failed'); }
    });
  };

  // ---- name gate ----
  if (!name) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nest-950 p-4">
        <div className="panel p-8 max-w-sm w-full text-center">
          <p className="text-indigo-400 font-mono font-bold text-3xl mb-2">&lt;/&gt;</p>
          <h2 className="text-lg font-bold text-white mb-2">Joining room <span className="font-mono text-indigo-300">{code}</span></h2>
          <p className="text-sm text-slate-400 mb-5">Please go back and enter your name first.</p>
          <Link to="/" className="btn-primary w-full">← Back to home</Link>
        </div>
      </div>
    );
  }

  // ---- fatal overlays ----
  if (joinError || fatal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nest-950 p-4">
        <div className="panel p-8 max-w-sm w-full text-center">
          <p className="text-4xl mb-3">{fatal ? '🪺' : '🚫'}</p>
          <h2 className="text-lg font-bold text-white mb-2">{fatal?.title || 'Could not join room'}</h2>
          <p className="text-sm text-slate-400 mb-5">{fatal?.msg || joinError}</p>
          <div className="flex gap-2">
            <Link to="/" className="btn-primary flex-1">Home</Link>
            <Link to="/dashboard" className="btn-ghost flex-1">Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- timers ----
  const sessionLeft = endsAt ? Math.max(0, endsAt - tick) : 0;
  const sm = Math.floor(sessionLeft / 60000); const ss = Math.floor((sessionLeft % 60000) / 1000);
  const elapsedPct = createdAt ? Math.min(100, ((tick - createdAt) / (endsAt - createdAt)) * 100) : 0;
  const taskLeft = learning && !learning.submitted ? Math.max(0, learning.endsAt - tick) : null;
  const tm = taskLeft != null ? Math.floor(taskLeft / 60000) : 0; const ts = taskLeft != null ? Math.floor((taskLeft % 60000) / 1000) : 0;
  const chatDisabled = mode === 'learning' && !learning?.submitted;
  const visibleCursors = remoteCursors.filter((c) => c.fileId === activeId && c.line > 0);

  return (
    <div className="h-screen flex flex-col bg-nest-950 overflow-hidden">
      {/* top bar */}
      <header className="border-b border-nest-700 bg-nest-900/80 shrink-0">
        <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-indigo-400 font-mono font-bold text-xl">&lt;/&gt;</span>
            <span className="font-bold text-white hidden sm:block">CodeNest</span>
          </Link>
          <span className="text-xs text-slate-500 hidden md:block">Python Team Practice</span>
          <button
            className="badge bg-nest-800 text-indigo-300 font-mono tracking-widest border border-nest-600 hover:border-indigo-500"
            onClick={() => { navigator.clipboard?.writeText(code); showToast('Room code copied!'); }}
            title="Copy room code"
          >
            {code} ⧉
          </button>

          <span className={`font-mono font-bold text-sm ${sessionLeft < 300000 ? 'text-red-400' : 'text-slate-200'}`}>
            ⏱ {sm}:{String(ss).padStart(2, '0')}
          </span>

          {/* participants */}
          <div className="flex items-center -space-x-2">
            {participants.map((p, i) => (
              <div key={p.socketId} className="relative group">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-nest-950 ${AVATAR_COLORS[i % 3]} ${p.muted ? 'opacity-50' : ''}`}
                  title={`${p.name}${p.isAdmin ? ' (admin)' : ''}`}
                >
                  {p.name[0]?.toUpperCase()}
                </div>
                {p.isAdmin && <span className="absolute -top-1.5 -right-1 text-[10px]" title="Admin">👑</span>}
                {isAdmin && p.socketId !== myId && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-30 hidden group-hover:flex gap-1 bg-nest-800 border border-nest-600 rounded-lg p-1 shadow-xl">
                    <button
                      className="text-xs px-1.5 py-0.5 hover:bg-nest-700"
                      title={p.muted ? 'Unmute' : 'Mute'}
                      onClick={() => socketRef.current?.emit('admin:mute', { target: p.socketId, muted: !p.muted })}
                    >
                      {p.muted ? '🔊' : '🔇'}
                    </button>
                    <button className="text-xs px-1.5 py-0.5 hover:bg-red-900/60" title="Remove from room" onClick={() => socketRef.current?.emit('admin:kick', { target: p.socketId })}>
                      ⏏
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {resultBadge && (
              <span className={`badge border ${resultBadge.score >= 70 ? 'bg-emerald-950 text-emerald-300 border-emerald-700' : resultBadge.score >= 40 ? 'bg-amber-950 text-amber-300 border-amber-700' : 'bg-red-950 text-red-300 border-red-700'}`}>
                🏆 Team Score {resultBadge.score}/100
              </span>
            )}
            {mode === 'practice' && !learning?.submitted && (
              <span className="badge bg-emerald-950 text-emerald-300 border border-emerald-800">● Practice Mode</span>
            )}
            {isAdmin && mode === 'practice' && (
              <button className="btn-primary py-1.5 text-xs" onClick={() => setShowStartModal(true)}>🎓 Start Learning Mode</button>
            )}
            {isAdmin && (
              <button
                className="btn-danger py-1.5 text-xs"
                onClick={() => {
                  if (window.confirm('End this session for everyone?')) {
                    socketRef.current?.emit('room:end', {}, () => {});
                  }
                }}
              >
                End Session
              </button>
            )}
            <button className="btn-ghost py-1.5 text-xs" onClick={() => navigate('/')}>Leave</button>
          </div>
        </div>
        {/* session progress */}
        <div className="h-1 bg-nest-800">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${elapsedPct}%` }} />
        </div>
      </header>

      {/* learning task countdown strip */}
      {taskLeft != null && (
        <div className="bg-purple-950/50 border-b border-purple-800/50 px-4 py-1.5 flex items-center justify-between shrink-0">
          <span className="text-xs text-purple-200">🎓 {learning.task.title} — Learning Mode active</span>
          <span className={`font-mono text-sm font-bold ${taskLeft < 60000 ? 'text-red-400 live-dot' : 'text-purple-100'}`}>{tm}:{String(ts).padStart(2, '0')}</span>
        </div>
      )}

      {/* main */}
      {!joined ? (
        <div className="flex-1 flex items-center justify-center text-slate-500">Connecting to the nest…</div>
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* editor column */}
          <div className="flex-1 flex flex-col min-w-0 relative">
            <LearningPanel
              learning={learning}
              evaluating={evaluating}
              result={result}
              onSubmit={submitSolution}
              onDismissResult={() => setResult(null)}
              onLoadStarter={() => socketRef.current?.emit('learning:loadStarter')}
            />
            <FileTabs files={files} activeId={activeId} onSelect={setActiveId} onCreate={createFile} onRename={renameFile} onDelete={deleteFile} />
            <CodeEditor
              file={activeFile}
              onLocalChange={onLocalChange}
              onCursor={onCursor}
              onEditorReady={(ed) => (editorRef.current = ed)}
              remoteCursors={visibleCursors}
              hints={hintsOn ? hints : []}
            />
            <ConsolePanel status={py.status} running={py.running} output={py.output} activeFile={activeFile} onRun={() => py.run(activeFile?.content || '')} onClear={py.clear} />
            <VoicePanel voice={voice} participants={participants} mode="videos" />
          </div>

          {/* right sidebar */}
          <aside className="w-[340px] shrink-0 border-l border-nest-700 flex flex-col min-h-0 hidden lg:flex">
            <div className="flex-1 min-h-0 border-b border-nest-700">
              <ChatbotPanel
                roomCode={code}
                activeFile={activeFile}
                hintsOn={hintsOn}
                onToggleHints={toggleHints}
                hints={hints}
                onHintClick={(line) => {
                  editorRef.current?.revealLineInCenter(line);
                  editorRef.current?.setPosition({ lineNumber: line, column: 1 });
                  editorRef.current?.focus();
                }}
              />
            </div>
            <div className="h-[45%] min-h-0 flex flex-col">
              <ChatPanel messages={chat} onSend={sendChat} disabled={chatDisabled} disabledNote="Team chat is disabled during Learning Mode" me={myId} />
              <div className="border-t border-nest-700 px-3 py-2 flex items-center justify-between gap-2 shrink-0 bg-nest-900/60">
                <span className="text-[10px] text-slate-500 uppercase tracking-wide">Voice &amp; Camera</span>
                <VoicePanel voice={voice} participants={participants} mode="controls" />
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* start learning modal */}
      {showStartModal && (
        <StartLearningModal
          busy={evaluating}
          onCancel={() => setShowStartModal(false)}
          onStart={({ topic, difficulty, minutes }) => {
            setEvaluating(true);
            socketRef.current?.emit('learning:start', { topic, difficulty, minutes }, (res) => {
              setEvaluating(false);
              if (!res?.ok) showToast(res?.error || 'Could not start Learning Mode');
            });
          }}
        />
      )}

      {/* toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-nest-800 border border-indigo-600 text-slate-100 text-sm px-4 py-2.5 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function StartLearningModal({ onStart, onCancel, busy }) {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [minutes, setMinutes] = useState(10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={busy ? undefined : onCancel}>
      <div className="panel max-w-md w-full p-6 border-purple-600/40" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-1">🎓 Start Learning Mode</h3>
        <p className="text-xs text-slate-400 mb-5">AI generates a timed task · chat gets disabled · Gemini evaluates the team solution at the end.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Topic (optional)</label>
            <input className="input" placeholder="e.g. lists, loops, string manipulation…" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Difficulty</label>
            <div className="grid grid-cols-3 gap-2">
              {['easy', 'medium', 'hard'].map((d) => (
                <button
                  key={d}
                  className={`py-2 rounded-lg text-sm font-semibold border capitalize transition ${difficulty === d ? 'bg-purple-600 border-purple-500 text-white' : 'bg-nest-800 border-nest-600 text-slate-400 hover:text-white'}`}
                  onClick={() => setDifficulty(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Duration</label>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 20].map((m) => (
                <button
                  key={m}
                  className={`py-2 rounded-lg text-sm font-semibold border transition ${minutes === m ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-nest-800 border-nest-600 text-slate-400 hover:text-white'}`}
                  onClick={() => setMinutes(m)}
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button className="btn-ghost flex-1" onClick={onCancel} disabled={busy}>Cancel</button>
            <button className="btn-primary flex-1" onClick={() => onStart({ topic, difficulty, minutes })} disabled={busy}>
              {busy ? '🤖 Generating task…' : 'Start Learning Mode'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
