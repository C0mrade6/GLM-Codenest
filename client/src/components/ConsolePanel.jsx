export default function ConsolePanel({ status, running, output, onRun, onClear, activeFile }) {
  return (
    <div className="border-t border-nest-700 bg-nest-950/80 flex flex-col shrink-0" style={{ height: '190px' }}>
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-nest-800 shrink-0">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-300">🖥️ Console</span>
        <span className={`text-[10px] ${status === 'ready' ? 'text-emerald-400' : status === 'error' ? 'text-red-400' : 'text-amber-400 live-dot'}`}>
          {status === 'ready' ? 'Python Environment Ready' : status === 'error' ? 'Python failed to load' : 'Loading Python (Pyodide)…'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn-green px-3 py-1 text-xs" onClick={onRun} disabled={status !== 'ready' || running}>
            {running ? '⏳ Running…' : '▶ Run'}
          </button>
          <button className="btn-ghost px-2.5 py-1 text-xs" onClick={onClear}>Clear</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs space-y-0.5">
        {output.length === 0 && <p className="text-slate-600">Output of {activeFile?.name || 'main.py'} will appear here. (input() is not supported)</p>}
        {output.map((o, i) => (
          <p key={i} className={o.kind === 'err' ? 'text-red-400' : o.kind === 'info' ? 'text-slate-500 italic' : o.kind === 'done' ? 'text-emerald-500 mt-1' : 'text-slate-300'}>
            {o.kind === 'done' ? `— finished in ${o.ms} ms —` : o.text}
          </p>
        ))}
      </div>
    </div>
  );
}
