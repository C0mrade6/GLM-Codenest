import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password, displayName } = req.body || {};
    const uname = String(username || '').trim().toLowerCase();
    const name = String(displayName || uname).trim();
    const pass = String(password || '');

    if (!/^[a-z0-9_]{3,24}$/.test(uname))
      return res.status(400).json({ error: 'Username must be 3-24 chars: letters, numbers, underscore' });
    if (pass.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (!name) return res.status(400).json({ error: 'Display name is required' });

    const existing = await User.findOne({ username: uname });
    if (existing) return res.status(409).json({ error: 'Username already taken' });

    const passwordHash = await bcrypt.hash(pass, 10);
    const user = await User.create({ username: uname, displayName: name, passwordHash });
    res.status(201).json({ token: signToken(user), user: { id: user._id, username: uname, displayName: name } });
  } catch (e) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const uname = String(username || '').trim().toLowerCase();
    const user = await User.findOne({ username: uname });
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });
    const ok = await bcrypt.compare(String(password || ''), user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid username or password' });
    res.json({ token: signToken(user), user: { id: user._id, username: user.username, displayName: user.displayName } });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).lean();
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json({ user: { id: user._id, username: user.username, displayName: user.displayName } });
});

export default router;
