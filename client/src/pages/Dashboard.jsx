import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/rooms/mine').then(setData).catch((e) => setError(e.message));
  }, []);

  const join = async () => {
    setError('');
    const c = joinCode.trim().toUpperCase();
    try {
      const { ok, reason } = await api(`/api/rooms/validate/${c}`);
      if (!ok) throw new Error(reason);
      navigate(`/room/${c}`);
    } catch (e) {
      setError(e.message);
    }
  };

  const stats = data?.stats || { roomsCreated: 0, submissions: 0, avgScore: null };

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
            <Link to="/results" className="btn-ghost">My Results</Link>
            <Link to="/" className="btn-ghost">Home</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

        {/* stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <div className="panel p-6">
            <p className="text-sm text-slate-400">Rooms Created</p>
            <p className="text-3xl font-extrabold text-white mt-1">{stats.roomsCreated}</p>
          </div>
          <div className="panel p-6">
            <p className="text-sm text-slate-400">Learning Submissions</p>
            <p className="text-3xl font-extrabold text-white mt-1">{stats.submissions}</p>
          </div>
          <div className="panel p-6">
            <p className="text-sm text-slate-400">Average Team Score</p>
            <p className={`text-3xl font-extrabold mt-1 ${stats.avgScore == null ? 'text-slate-500' : stats.avgScore >= 70 ? 'text-emerald-400' : stats.avgScore >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
              {stats.avgScore == null ? '—' : `${stats.avgScore}/100`}
            </p>
          </div>
        </div>

        {/* quick join */}
        <div className="panel p-6 mb-8 flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Join a room by code</label>
            <input
              className="input font-mono uppercase tracking-[0.3em]"
              placeholder="AB12CD"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && join()}
            />
          </div>
          <button className="btn-primary" onClick={join}>Enter Room</button>
          <button className="btn-green" onClick={() => navigate('/')}>➕ New Room</button>
        </div>
        {error && <p className="text-sm text-red-400 mb-6">{error}</p>}

        {/* recent rooms */}
        <h2 className="text-lg font-bold text-white mb-4">Recent Rooms</h2>
        {!data ? (
          <p className="text-slate-500">Loading…</p>
        ) : data.rooms.length === 0 ? (
          <div className="panel p-10 text-center text-slate-400">No rooms yet. Create your first nest from the home page! 🪺</div>
        ) : (
          <div className="space-y-3">
            {data.rooms.map((r) => (
              <div key={r.code} className="panel p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono font-bold text-indigo-300 tracking-wider">{r.code}</span>
                    {r.status === 'active' && Date.now() < r.endsAt ? (
                      <span className="badge bg-emerald-950 text-emerald-300 border border-emerald-800">● active</span>
                    ) : (
                      <span className="badge bg-nest-800 text-slate-400">ended</span>
                    )}
                    {r.task && <span className="badge bg-purple-950 text-purple-300 border border-purple-800">{r.task}</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Created {new Date(r.createdAt).toLocaleString()}</p>
                </div>
                {r.status === 'active' && Date.now() < r.endsAt && (
                  <button className="btn-ghost shrink-0" onClick={() => navigate(`/room/${r.code}`)}>Rejoin →</button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
