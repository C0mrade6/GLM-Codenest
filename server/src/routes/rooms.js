import { Router } from 'express';
import Room from '../models/Room.js';
import Submission from '../models/Submission.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { createRoomDb, getState, MAX_PARTICIPANTS, ROOM_MINUTES } from '../sockets/roomStore.js';

const router = Router();

// Create a new room. Works for logged-in users and guests (name required for guests).
router.post('/', optionalAuth, async (req, res) => {
  try {
    const guestName = String(req.body?.name || '').trim().slice(0, 40);
    if (!req.userId && !guestName) return res.status(400).json({ error: 'Provide your name or log in first' });
    const doc = await createRoomDb({
      createdByUserId: req.userId || undefined,
      createdByGuestName: req.userId ? '' : guestName,
    });
    res.status(201).json({ code: doc.code, endsAt: doc.endsAt, maxMinutes: ROOM_MINUTES });
  } catch (e) {
    console.error('[rooms] create failed:', e.message);
    res.status(500).json({ error: 'Could not create room' });
  }
});

// Validate a room code before joining (from the landing page).
router.get('/validate/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const doc = await Room.findOne({ code });
    if (!doc) return res.json({ ok: false, reason: 'Room not found. Check the code.' });
    if (doc.status === 'ended') return res.json({ ok: false, reason: 'This session has already ended.' });
    if (Date.now() > doc.endsAt) return res.json({ ok: false, reason: 'This session has expired (60 min limit).' });
    const state = getState(code);
    const count = state ? state.participants.length : 0;
    if (count >= MAX_PARTICIPANTS) return res.json({ ok: false, reason: `Room is full (max ${MAX_PARTICIPANTS} coders).` });
    res.json({ ok: true, endsAt: doc.endsAt });
  } catch {
    res.status(500).json({ error: 'Validation failed' });
  }
});

// Dashboard data for logged-in users.
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const rooms = await Room.find({
      $or: [{ createdByUserId: req.userId }, { 'participants.userId': req.userId }],
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const subs = await Submission.find({ 'participants.userId': req.userId }).sort({ createdAt: -1 }).limit(50).lean();
    const avgScore = subs.length ? Math.round(subs.reduce((s, x) => s + x.score, 0) / subs.length) : null;

    res.json({
      rooms: rooms.map((r) => ({
        code: r.code,
        status: r.status,
        mode: r.mode,
        createdAt: r.createdAt,
        endsAt: r.endsAt,
        task: r.learningTaskTitle,
      })),
      stats: {
        roomsCreated: await Room.countDocuments({ createdByUserId: req.userId }),
        submissions: subs.length,
        avgScore,
      },
    });
  } catch {
    res.status(500).json({ error: 'Could not load dashboard' });
  }
});

// Submission history for the Results page.
router.get('/submissions', requireAuth, async (req, res) => {
  try {
    const subs = await Submission.find({ 'participants.userId': req.userId }).sort({ createdAt: -1 }).limit(30).lean();
    res.json({
      submissions: subs.map((s) => ({
        id: s._id,
        roomCode: s.roomCode,
        taskTitle: s.taskTitle,
        difficulty: s.difficulty,
        score: s.score,
        feedback: s.feedback,
        files: s.files,
        participants: s.participants.map((p) => p.name),
        createdAt: s.createdAt,
      })),
    });
  } catch {
    res.status(500).json({ error: 'Could not load results' });
  }
});

export default router;
