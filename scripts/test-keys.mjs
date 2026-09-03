// Quick validation of Gemini API key and MongoDB Atlas connectivity.
// Usage: node scripts/test-keys.mjs  (reads server/.env)
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const envPath = new URL('../server/.env', import.meta.url);
try {
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  console.log('No server/.env found yet — set env vars manually.');
}

const key = process.env.GEMINI_API_KEY;
const mongoUri = process.env.MONGODB_URI;

// --- Gemini test ---
if (!key) {
  console.log('GEMINI: MISSING (no GEMINI_API_KEY set)');
} else {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with exactly: OK' }] }] }),
      }
    );
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '(empty)';
      console.log('GEMINI: SUCCESS — model replied:', JSON.stringify(text.slice(0, 50)));
    } else {
      console.log('GEMINI: FAILED —', res.status, JSON.stringify(body?.error?.message || body).slice(0, 300));
    }
  } catch (e) {
    console.log('GEMINI: NETWORK ERROR —', e.message);
  }
}

// --- MongoDB test (uses mongoose if installed, otherwise raw DNS hint) ---
if (!mongoUri) {
  console.log('MONGO: MISSING (no MONGODB_URI set)');
} else {
  try {
    const mongoose = await import('mongoose');
    await mongoose.connect(mongoUri, { dbName: 'codenest', serverSelectionTimeoutMS: 10000 });
    const dbName = mongoose.connection.db?.databaseName || 'codenest';
    await mongoose.connection.db?.admin().ping();
    console.log('MONGO: SUCCESS — connected to', dbName);
    await mongoose.disconnect();
  } catch (e) {
    console.log('MONGO: FAILED —', e.message?.slice(0, 300));
  }
}
