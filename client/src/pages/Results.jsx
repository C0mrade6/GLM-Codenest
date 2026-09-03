import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

function ScoreRing({ score }) {
  const color = score >= 70 ? '#34d399' : score >= 40 ? '#fbbf24' : '#f87171';
  return (
    <div
      className="w-16 h-16 rounded-full flex items-center justify-center font-extrabold text-lg shrink-0"
      style={{ background: `conic-gradient(${color} ${score * 3.6}deg, #182452 0deg)` }}
    >
      <div className="w-12 h-12 rounded-full bg-nest-900 flex items-center justify-center" style={{ color }}>{score}</div>
    </div>
  );
}

export default function Results() {
  const { user } = useAuth();
  const [subs, setSubs] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    api('/api/rooms/submissions').then((d) => setSubs(d.submissions)).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-nest-950 via-nest-900 to-nest-950">
      <header className="border-b border-nest-700/60">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="text-indigo-400 font-mono font-bold text-2xl">&lt;/&gt;</span>
            <span className="font-bold text-xl text-white">CodeNest</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-300">Hi, {user?.displayName}</span>
            <Link to="/dashboard" className="btn-ghost">Dashboard</Link>
            <Link to="/" className="btn-ghost">Home</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-white mb-2">Results Dashboard</h1>
        <p className="text-slate-400 mb-8 text-sm">Your Learning Mode evaluations and team scores.</p>

        {error && <p className="text-red-400 mb-6">{error}</p>}
        {!subs ? (
          <p className="text-slate-500">Loading…</p>
        ) : subs.length === 0 ? (
          <div className="panel p-10 text-center text-slate-400">
            No evaluations yet. Start a Learning Mode round in a room — your team score will appear here. 🎯
          </div>
        ) : (
          <div className="space-y-4">
            {subs.map((s) => (
              <div key={s.id} className="panel overflow-hidden">
                <button className="w-full p-5 flex items-center gap-5 text-left hover:bg-nest-800/50 transition" onClick={() => setOpenId(openId === s.id ? null : s.id)}>
                  <ScoreRing score={s.score} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{s.taskTitle}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Room <span className="font-mono text-indigo-300">{s.roomCode}</span> · {s.difficulty} · with {s.participants.join(', ')}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{new Date(s.createdAt).toLocaleString()}</p>
                  </div>
                  <span className="text-slate-500">{openId === s.id ? '▲' : '▼'}</span>
                </button>
                {openId === s.id && (
                  <div className="border-t border-nest-700 p-5 space-y-4 bg-nest-950/40">
                    <p className="text-sm text-slate-300 leading-relaxed">{s.feedback?.summary}</p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-emerald-400 mb-2">💪 Strengths</p>
                        <ul className="text-sm text-slate-300 space-y-1.5">
                          {(s.feedback?.strengths || []).map((x, i) => <li key={i}>• {x}</li>)}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-amber-400 mb-2">🔧 Improvements</p>
                        <ul className="text-sm text-slate-300 space-y-1.5">
                          {(s.feedback?.improvements || []).map((x, i) => <li key={i}>• {x}</li>)}
                        </ul>
                      </div>
                    </div>
                    {(s.feedback?.fileComments || []).length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-indigo-300 mb-2">📄 File Feedback</p>
                        {s.feedback.fileComments.map((c, i) => (
                          <p key={i} className="text-sm text-slate-300"><span className="font-mono text-indigo-300">{c.file}:</span> {c.comment}</p>
                        ))}
                      </div>
                    )}
                    <details className="text-sm">
                      <summary className="cursor-pointer text-slate-400 hover:text-slate-200">View submitted code ({s.files.length} file{s.files.length > 1 ? 's' : ''})</summary>
                      <div className="mt-3 space-y-3">
                        {s.files.map((f, i) => (
                          <pre key={i} className="bg-nest-950 border border-nest-700 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto font-mono">
                            <span className="text-indigo-300 font-bold"># {f.name}</span>{'\n'}{f.content}
                          </pre>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
