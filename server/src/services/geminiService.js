// Google Gemini service — the single AI provider for CodeNest.
// Powers: RAG chatbot (context-aware answers), code hints (JSON),
// task generation (JSON) and solution evaluation (JSON).
// Uses plain fetch against the REST API — no SDK lock-in.

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.0-flash'];
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function stripFences(text) {
  return String(text)
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

async function callGemini({ system, user, json = false, temperature = 0.7, maxOutputTokens = 4096 }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not configured');

  const body = JSON.stringify({
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature,
      maxOutputTokens,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  });

  // Try the primary model, then fall back on overload/unavailability.
  const models = [MODEL, ...FALLBACK_MODELS];
  let lastError;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${BASE}/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body,
        });
        const resp = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(resp?.error?.message || `Gemini HTTP ${res.status}`);
        const text = resp?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
        if (!text) throw new Error('Gemini returned an empty response');
        return text;
      } catch (e) {
        lastError = e;
        const transient = /high demand|overload|429|503|rate/i.test(e.message) || e.name === 'TypeError';
        if (transient && attempt === 0) {
          await new Promise((r) => setTimeout(r, 1800));
          continue;
        }
        break;
      }
    }
    // non-transient or both attempts failed — try next model if it looks model-specific
    if (!/high demand|overload|429|503|rate|not found|no longer available/i.test(lastError?.message || '')) break;
  }
  throw lastError || new Error('Gemini request failed');
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(stripFences(text));
  } catch {
    try {
      // rescue JSON embedded in prose
      const m = stripFences(text).match(/[[{][\s\S]*[\]}]/);
      if (m) return JSON.parse(m[0]);
    } catch { /* fall through */ }
    return fallback;
  }
}

const TUTOR_SYSTEM =
  'You are the CodeNest AI tutor — a friendly expert Python teaching assistant inside a collaborative ' +
  'coding room. You receive the team\'s current Python files, recent chat and (if any) the active task as context. ' +
  'This retrieved context IS your knowledge — ground every answer in it (simple RAG). Be concise (under 180 words), ' +
  'practical and beginner-friendly. When you reference code, cite exact line numbers like "Line 12: ...". ' +
  'Use short markdown-free plain text with line breaks. Never invent code that contradicts the files.';

export async function chatReply({ question, files, chatHistory, task }) {
  const fileCtx = files
    .map((f) => `--- FILE: ${f.name} ---\n${String(f.content || '').slice(0, 6000)}`)
    .join('\n\n');
  const chatCtx = (chatHistory || []).slice(-8).map((m) => `${m.role === 'user' ? 'Coder' : 'AI'}: ${m.text}`).join('\n');
  const taskCtx = task ? `ACTIVE LEARNING TASK:\n${task.title}\n${task.description}` : 'No active task (Practice Mode).';

  const user = `CONTEXT\n${taskCtx}\n\nCURRENT CODE:\n${fileCtx}\n\nRECENT CONVERSATION:\n${chatCtx || '(none)'}\n\nCODER QUESTION: ${question}`;

  const text = await callGemini({ system: TUTOR_SYSTEM, user, temperature: 0.5, maxOutputTokens: 1024 });
  return text.trim();
}

export async function generateHints({ fileName, code }) {
  const system =
    'You are a Python code reviewer. Analyse the code and return ONLY JSON: ' +
    '{"hints":[{"line":<int>,"hint":"<max 15 words>"}]} with at most 4 hints. ' +
    'Focus on bugs first, then clarity/performance/Pythonic style. Line numbers must exist in the code. ' +
    'If the code is clean or trivial, return {"hints":[]}.';
  const user = `FILE ${fileName}:\n${String(code || '').slice(0, 8000)}`;
  const out = parseJson(await callGemini({ system, user, json: true, temperature: 0.3, maxOutputTokens: 1024 }), { hints: [] });
  const hints = Array.isArray(out.hints) ? out.hints : [];
  return hints
    .filter((h) => h && Number.isFinite(Number(h.line)) && h.hint)
    .slice(0, 4)
    .map((h) => ({ line: Number(h.line), hint: String(h.hint).slice(0, 120) }));
}

export async function generateTask({ topic, difficulty }) {
  const system =
    'You create short, self-contained Python practice tasks for a team of university students. ' +
    'Return ONLY JSON: {"title":string, "description":string (2-4 sentences, what to build), ' +
    '"requirements":string[] (3-6 concrete checkable requirements), ' +
    '"starterCode":string (short Python starter with a TODO comment), "hint":string (one nudge)}. ' +
    'Tasks must be solvable in a few minutes using only the Python standard library, print/return based ' +
    '(no stdin, no external libs). Keep titles under 8 words.';
  const user = `Create a ${difficulty} difficulty Python task${topic ? ` about: ${topic}` : ' (your choice of a good learning topic)'}.`;
  const out = parseJson(
    await callGemini({ system, user, json: true, temperature: 0.9, maxOutputTokens: 2048 }),
    null
  );
  if (!out || !out.title || !out.description) throw new Error('Task generation returned invalid JSON');
  return {
    title: String(out.title).slice(0, 100),
    description: String(out.description).slice(0, 900),
    requirements: (Array.isArray(out.requirements) ? out.requirements : []).map(String).slice(0, 6),
    starterCode: String(out.starterCode || '# Write your solution here\n'),
    hint: String(out.hint || '').slice(0, 300),
    difficulty,
  };
}

export async function evaluateSolution({ task, files, teamSize }) {
  const system =
    'You are a strict but fair Python examiner for a collaborative learning platform. ' +
    'Grade the TEAM solution for the given task. Return ONLY JSON: ' +
    '{"score":<int 0-100>, "summary":string (2-3 sentences), "strengths":string[], "improvements":string[], ' +
    '"fileComments":[{"file":string,"comment":string}]}. ' +
    'Score honestly: correctness first (~60%), requirements met (~20%), code quality/Pythonic style (~20%). ' +
    'Reference line numbers in comments when useful.';
  const fileCtx = files.map((f) => `--- FILE: ${f.name} ---\n${String(f.content || '').slice(0, 6000)}`).join('\n\n');
  const user = `TASK (${task.difficulty}):\n${task.title}\n${task.description}\nRequirements:\n${(task.requirements || [])
    .map((r) => '- ' + r)
    .join('\n')}\n\nTEAM SOLUTION (${teamSize} coders):\n${fileCtx}`;
  const out = parseJson(
    await callGemini({ system, user, json: true, temperature: 0.3, maxOutputTokens: 2048 }),
    null
  );
  if (!out || !Number.isFinite(Number(out.score))) throw new Error('Evaluation returned invalid JSON');
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(out.score)))),
    summary: String(out.summary || '').slice(0, 600),
    strengths: (Array.isArray(out.strengths) ? out.strengths : []).map(String).slice(0, 5),
    improvements: (Array.isArray(out.improvements) ? out.improvements : []).map(String).slice(0, 5),
    fileComments: (Array.isArray(out.fileComments) ? out.fileComments : [])
      .filter((c) => c && c.file)
      .map((c) => ({ file: String(c.file).slice(0, 60), comment: String(c.comment || '').slice(0, 300) }))
      .slice(0, 3),
  };
}

export const geminiModel = MODEL;
