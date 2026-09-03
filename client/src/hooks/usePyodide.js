// In-browser Python execution via Pyodide, sandboxed in a Web Worker.
// Mirrors the proposal's "secure browser-based compiler — no server-side execution".
import { useEffect, useRef, useState, useCallback } from 'react';

const PYODIDE_VERSION = '0.26.4';
const CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export function usePyodide() {
  const workerRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState([]);
  const pending = useRef(null);

  useEffect(() => {
    let worker;
    try {
      worker = new Worker(new URL('../workers/pyWorker.js', import.meta.url), { type: 'module' });
    } catch {
      setStatus('error');
      return;
    }
    workerRef.current = worker;
    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'ready') setStatus('ready');
      else if (msg.type === 'stdout') setOutput((o) => [...o.slice(-400), { kind: 'out', text: msg.text }]);
      else if (msg.type === 'stderr') setOutput((o) => [...o.slice(-400), { kind: 'err', text: msg.text }]);
      else if (msg.type === 'done') {
        setRunning(false);
        setOutput((o) => [...o.slice(-400), { kind: 'done', ms: msg.ms }]);
        pending.current?.();
        pending.current = null;
      } else if (msg.type === 'error') {
        setStatus('error');
        setRunning(false);
        setOutput((o) => [...o.slice(-400), { kind: 'err', text: msg.text }]);
      }
    };
    return () => worker.terminate();
  }, []);

  const run = useCallback((code) => {
    const w = workerRef.current;
    if (!w || status !== 'ready') return false;
    setRunning(true);
    setOutput([{ kind: 'info', text: 'Running…' }]);
    w.postMessage({ type: 'run', code });
    return true;
  }, [status]);

  const clear = useCallback(() => setOutput([]), []);

  return { status, running, output, run, clear };
}
