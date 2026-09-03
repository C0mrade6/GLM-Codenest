import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthModal({ mode, onClose }) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState(mode); // 'login' | 'register'
  const [form, setForm] = useState({ username: '', password: '', displayName: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      if (tab === 'login') await login(form.username, form.password);
      else await register(form.username, form.password, form.displayName || form.username);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="panel w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{tab === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <button className="text-slate-400 hover:text-white text-xl leading-none" onClick={onClose}>×</button>
        </div>
        <div className="flex gap-1 bg-nest-950/70 rounded-lg p-1 mb-5">
          {['login', 'register'].map((t) => (
            <button
              key={t}
              className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition ${tab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => { setTab(t); setError(''); }}
            >
              {t === 'login' ? 'Log in' : 'Sign up'}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          <input className="input" placeholder="Username" value={form.username} onChange={set('username')} autoComplete="username" />
          {tab === 'register' && (
            <input className="input" placeholder="Display name (optional)" value={form.displayName} onChange={set('displayName')} maxLength={40} />
          )}
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={set('password')}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn-primary w-full py-2.5" onClick={submit} disabled={busy}>
            {busy ? 'Please wait…' : tab === 'login' ? 'Log in' : 'Create account'}
          </button>
          <p className="text-xs text-slate-500 text-center">Accounts keep your room history and team scores. You can also join as a guest from the home page.</p>
        </div>
      </div>
    </div>
  );
}
