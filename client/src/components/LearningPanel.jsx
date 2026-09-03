import { useEffect, useState } from 'react';

function useCountdown(endsAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  if (!endsAt) return null;
  const ms = Math.max(0, endsAt - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { ms, label: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, urgent: ms < 60000 };
}

// Learning Mode banner: task, server-synced countdown, submit + results.
export default function LearningPanel({ learning, evaluating, result, onSubmit, onDismissResult, onLoadStarter }) {
  const countdown = useCountdown(learning?.endsAt);
  const [showHint, setShowHint] = useState(false);
  if (!learning) return null;

  return (
    <>
      {/* task banner */}
      {!result && !learning.submitted && (
        <div className="mx-3 mt-3 panel border-purple-600/50 bg-gradient-to-r from-purple-950/60 to-indigo-950/60 p-4 shrink-0">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="badge bg-purple-600 text-white">🎓 Learning Mode</span>
                <span className="badge bg-nest-800 text-slate-300 capitalize">{learning.task.difficulty}</span>
                <span className="text-[11px] text-slate-400">Chat disabled · Focus on the task</span>
              </div>
              <h3 className="font-bold text-white">{learning.task.title}</h3>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">{learning.task.description}</p>
              <ul className="mt-2 text-xs text-slate-400 space-y-1">
                {learning.task.requirements.map((r, i) => <li key={i}>✓ {r}</li>)}
              </ul>
              <div className="mt-2 flex gap-3">
                <button className="text-xs text-indigo-300 hover:text-indigo-200 underline" onClick={() => setShowHint(!showHint)}>
                  {showHint ? 'Hide hint' : '💡 Need a hint?'}
                </button>
                {learning.task.starterCode && (
                  <button className="text-xs text-indigo-300 hover:text-indigo-200 underline" onClick={onLoadStarter}>
                    📄 Load starter code into {`main file`}
                  </button>
                )}
              </div>
              {showHint && <p className="mt-2 text-xs text-amber-200 bg-amber-950/40 border border-amber-800/50 rounded-lg px-3 py-2">{learning.task.hint}</p>}
            </div>
            <div className="text-center shrink-0">
              <div className={`font-mono text-3xl font-extrabold ${countdown?.urgent ? 'text-red-400' : 'text-white'}`}>{countdown?.label ?? '--:--'}</div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-1">time left</p>
              {learning.submitted ? (
                <span className="badge bg-emerald-950 text-emerald-300 border border-emerald-800 mt-3">Submitted — evaluating…</span>
              ) : (
                <button className="btn-primary mt-3 px-5" onClick={onSubmit} disabled={evaluating}>
                  {evaluating ? '🤖 Evaluating…' : '📦 Submit Solution'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* result modal */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="panel max-w-lg w-full p-7 border-purple-600/40 shadow-2xl">
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-purple-300 mb-2">Learning Mode Complete</p>
              <div
                className="mx-auto w-28 h-28 rounded-full flex items-center justify-center font-extrabold text-3xl"
                style={{ background: `conic-gradient(${result.score >= 70 ? '#34d399' : result.score >= 40 ? '#fbbf24' : '#f87171'} ${result.score * 3.6}deg, #182452 0deg)` }}
              >
                <div className="w-20 h-20 rounded-full bg-nest-900 flex items-center justify-center" style={{ color: result.score >= 70 ? '#34d399' : result.score >= 40 ? '#fbbf24' : '#f87171' }}>
                  {result.score}<span className="text-sm text-slate-500">/100</span>
                </div>
              </div>
              <p className="text-lg font-bold text-white mt-3">Team Score</p>
            </div>
            <p className="text-sm text-slate-300 mt-4 leading-relaxed">{result.summary}</p>
            {result.strengths?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase text-emerald-400 mb-1">💪 Strengths</p>
                <ul className="text-sm text-slate-300 space-y-1">{result.strengths.map((s, i) => <li key={i}>• {s}</li>)}</ul>
              </div>
            )}
            {result.improvements?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold uppercase text-amber-400 mb-1">🔧 Improvements</p>
                <ul className="text-sm text-slate-300 space-y-1">{result.improvements.map((s, i) => <li key={i}>• {s}</li>)}</ul>
              </div>
            )}
            {result.fileComments?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold uppercase text-indigo-300 mb-1">📄 File Feedback</p>
                {result.fileComments.map((c, i) => (
                  <p key={i} className="text-sm text-slate-300"><span className="font-mono text-indigo-300">{c.file}:</span> {c.comment}</p>
                ))}
              </div>
            )}
            <button className="btn-primary w-full mt-6 py-2.5" onClick={onDismissResult}>Continue Coding →</button>
          </div>
        </div>
      )}
    </>
  );
}
