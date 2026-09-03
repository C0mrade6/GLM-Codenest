import { Router } from 'express';
import { getOrCreateState } from '../sockets/roomStore.js';
import { chatReply, generateHints } from '../services/geminiService.js';

const router = Router();

// RAG chatbot: assembles the room's live code + chat + task as retrieved context,
// then asks Gemini to answer grounded in it. History kept in memory per room.
router.post('/chat', async (req, res) => {
  try {
    const roomCode = String(req.body?.roomCode || '').trim().toUpperCase();
    const message = String(req.body?.message || '').trim().slice(0, 800);
    if (!roomCode || !message) return res.status(400).json({ error: 'roomCode and message are required' });

    const state = await getOrCreateState(roomCode);
    if (!state) return res.status(404).json({ error: 'Room not found or no longer active' });

    state.chatbot.push({ role: 'user', text: message });
    const reply = await chatReply({
      question: message,
      files: state.files,
      chatHistory: state.chatbot.slice(-9, -1),
      task: state.mode === 'learning' ? state.learning?.task : null,
    });
    state.chatbot.push({ role: 'assistant', text: reply });
    if (state.chatbot.length > 40) state.chatbot = state.chatbot.slice(-40);

    res.json({ reply });
  } catch (e) {
    console.error('[ai] chat failed:', e.message);
    res.status(503).json({ error: 'AI assistant is unavailable right now. Please try again in a moment.' });
  }
});

// AI Hints: line-specific suggestions for one file (JSON response).
router.post('/hints', async (req, res) => {
  try {
    const roomCode = String(req.body?.roomCode || '').trim().toUpperCase();
    const fileId = String(req.body?.fileId || '');
    const state = await getOrCreateState(roomCode);
    if (!state) return res.status(404).json({ error: 'Room not found or no longer active' });
    const file = state.files.find((f) => f.id === fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    const hints = await generateHints({ fileName: file.name, code: file.content });
    res.json({ hints });
  } catch (e) {
    console.error('[ai] hints failed:', e.message);
    res.status(503).json({ error: 'AI hints are unavailable right now.' });
  }
});

export default router;
