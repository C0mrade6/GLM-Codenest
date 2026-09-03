import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import AuthModal from '../components/AuthModal.jsx';

export default function Landing() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [name, setName] = useState(localStorage.getItem('codenest:name') || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAuth, setShowAuth] = useState(null); // null | 'login' | 'register'

  const requireName = () => {
    const n = name.trim();
    if (!n) {
      setError('Please enter your name first.');
      return null;
    }
    localStorage.setItem('codenest:name', n);
    return n;
  };

  const joinRoom = async () => {
    setError('');
    const n = requireName();
    if (!n) return;
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(c)) {
      setError('Room code must be 6 characters (e.g. AB12CD).');
      return;
    }
    setBusy(true);
    try {
      const { ok, reason } = await api(`/api/rooms/validate/${c}`);
      if (!ok) throw new Error(reason);
      navigate(`/room/${c}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const createRoom = async () => {
    setError('');
    const n = requireName();
    if (!n) return;
    setBusy(true);
    try {
      const { code: newCode } = await api('/api/rooms', { method: 'POST', body: { name: n } });
      navigate(`/room/${newCode}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-nest-950 via-nest-900 to-nest-950">
      {/* header */}
      <header className="border-b border-nest-700/60">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-indigo-400 font-mono font-bold text-2xl">&lt;/&gt;</span>
            <span className="font-bold text-xl tracking-tight text-white">CodeNest</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button className="btn-ghost" onClick={() => navigate('/dashboard')}>Dashboard</button>
                <button className="btn-ghost" onClick={() => navigate('/results')}>My Results</button>
                <span className="text-sm text-slate-300 hidden sm:block">Hi, {user.displayName}</span>
                <button className="text-sm text-slate-400 hover:text-white" onClick={logout}>Log out</button>
              </>
            ) : (
              <>
                <button className="btn-ghost" onClick={() => setShowAuth('login')}>Log in</button>
                <button className="btn-primary" onClick={() => setShowAuth('register')}>Sign up</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* hero */}
      <main className="flex-1 max-w-6xl mx-auto px-6 py-12 w-full">
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
            Collaborate. Code. <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Conquer with AI!</span>
          </h1>
          <p className="mt-3 text-slate-400 text-lg">Real-time collaborative Python learning platform — up to 3 coders, one nest.</p>
        </div>

        {/* join card */}
        <div className="panel max-w-md mx-auto p-6 sm:p-8 shadow-2xl shadow-indigo-950/50">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Your Name</label>
              <input className="input" placeholder="e.g. Waqar" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Room Code</label>
              <input
                className="input font-mono uppercase tracking-[0.3em] text-center"
                placeholder="AB12CD"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              />
            </div>
            {error && <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</p>}
            <button className="btn-primary w-full py-3 text-base" onClick={joinRoom} disabled={busy}>
              {busy ? 'Checking…' : '🚀 Enter CodeNest'}
            </button>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <div className="h-px bg-nest-700 flex-1" /> or <div className="h-px bg-nest-700 flex-1" />
            </div>
            <button className="btn-ghost w-full py-3" onClick={createRoom} disabled={busy}>
              ➕ Create New Room
            </button>
            <p className="text-xs text-slate-500 text-center">Max 3 coders · 60-minute sessions · Python only</p>
          </div>
        </div>

        {/* feature cards */}
        <div className="grid sm:grid-cols-3 gap-5 mt-14">
          {[
            { icon: '👥', title: 'Team Collaboration', desc: 'Code together in real time with your team — synced files, live cursors and chat.' },
            { icon: '🤖', title: 'AI-Powered Learning', desc: 'Get intelligent code suggestions, line-specific feedback and instant evaluation.' },
            { icon: '⚡', title: 'Instant Practice', desc: 'Practice mode for quick coding challenges with an in-browser Python engine.' },
          ].map((f) => (
            <div key={f.title} className="panel p-6 hover:border-indigo-500/50 transition group">
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{f.icon}</div>
              <h3 className="font-bold text-white mb-1.5">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-nest-700/60 py-5 text-center text-xs text-slate-500">
        CodeNest — Final Year Project · Collaborative Python Learning with AI
      </footer>

      {showAuth && <AuthModal mode={showAuth} onClose={() => setShowAuth(null)} onDone={() => setShowAuth(null)} />}
    </div>
  );
}
