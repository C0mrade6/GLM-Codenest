import { useState } from 'react';

export default function FileTabs({ files, activeId, onSelect, onCreate, onRename, onDelete, canEdit }) {
  const [menuFor, setMenuFor] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const create = () => {
    const n = newName.trim();
    if (n) onCreate(n);
    setNewName('');
    setCreating(false);
  };

  return (
    <div className="flex items-center gap-1 px-2 pt-2 border-b border-nest-700 overflow-x-auto shrink-0 bg-nest-900/60 rounded-t-xl">
      {files.map((f) => (
        <div
          key={f.id}
          className={`group relative flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-lg cursor-pointer border-t border-x whitespace-nowrap transition ${
            f.id === activeId
              ? 'bg-nest-950 border-nest-700 text-white font-semibold'
              : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-nest-800/60'
          }`}
          onClick={() => onSelect(f.id)}
        >
          <span className="text-indigo-400">🐍</span>
          <span className="font-mono">{f.name}</span>
          <button
            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white ml-1"
            onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === f.id ? null : f.id); }}
            title="File options"
          >
            ⋯
          </button>
          {menuFor === f.id && (
            <div className="absolute top-full right-0 z-20 mt-1 w-36 bg-nest-800 border border-nest-600 rounded-lg shadow-xl py-1 text-sm" onClick={(e) => e.stopPropagation()}>
              <button
                className="w-full text-left px-3 py-1.5 text-slate-300 hover:bg-nest-700"
                onClick={() => {
                  const n = prompt('Rename file', f.name);
                  if (n && n.trim()) onRename(f.id, n.trim());
                  setMenuFor(null);
                }}
              >
                ✏️ Rename
              </button>
              {files.length > 1 && (
                <button
                  className="w-full text-left px-3 py-1.5 text-red-300 hover:bg-nest-700"
                  onClick={() => {
                    if (window.confirm(`Delete ${f.name}?`)) onDelete(f.id);
                    setMenuFor(null);
                  }}
                >
                  🗑️ Delete
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {files.length < 3 && !creating && (
        <button className="px-3 py-2 text-slate-400 hover:text-white text-lg leading-none" title="Add file (max 3)" onClick={() => setCreating(true)}>
          +
        </button>
      )}
      {creating && (
        <div className="flex items-center gap-1 px-2 py-1.5">
          <input
            autoFocus
            className="bg-nest-950 border border-indigo-500 rounded px-2 py-0.5 text-sm w-28 font-mono outline-none"
            placeholder="utils.py"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') create();
              if (e.key === 'Escape') { setCreating(false); setNewName(''); }
            }}
            onBlur={create}
          />
        </div>
      )}
      <span className="ml-auto pr-2 text-[11px] text-slate-500 whitespace-nowrap hidden sm:block">{files.length}/3 files</span>
    </div>
  );
}
