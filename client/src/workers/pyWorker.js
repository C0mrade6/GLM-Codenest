// Pyodide web worker — loads the Python runtime from CDN and executes code
// fully inside the browser (secure, serverless execution).
import { loadPyodide } from 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.mjs';

let pyodidePromise = null;

function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/' });
  }
  return pyodidePromise;
}

getPyodide()
  .then(() => postMessage({ type: 'ready' }))
  .catch((e) => postMessage({ type: 'error', text: 'Failed to load Python environment: ' + e.message }));

self.onmessage = async (e) => {
  if (e.data?.type !== 'run') return;
  const { code } = e.data;
  const t0 = performance.now();
  let pyodide;
  try {
    pyodide = await getPyodide();
    pyodide.setStdout({ batched: (s) => postMessage({ type: 'stdout', text: s }) });
    pyodide.setStderr({ batched: (s) => postMessage({ type: 'stderr', text: s }) });
    await pyodide.runPythonAsync(code);
    postMessage({ type: 'done', ms: Math.round(performance.now() - t0) });
  } catch (err) {
    // Python traceback — show only the meaningful last lines
    const lines = String(err.message || err).trim().split('\n');
    postMessage({ type: 'stderr', text: lines.slice(-8).join('\n') });
    postMessage({ type: 'done', ms: Math.round(performance.now() - t0) });
  }
};
