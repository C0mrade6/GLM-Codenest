import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Also try the repo-root .env so running from root works too.
dotenv.config({ path: path.join(__dirname, '../../.env') });

import express from 'express';
import http from 'node:http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';

import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import aiRoutes from './routes/ai.js';
import { initSockets } from './sockets/index.js';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: true, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e6,
  pingTimeout: 20000,
});

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 25, standardHeaders: true });

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'codenest', time: Date.now() }));
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);

// Serve the built client (production / Render all-in-one).
const clientDist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api|socket\.io).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error('[http] unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    initSockets(io);
    server.listen(PORT, () => console.log(`[codenest] server listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('[codenest] failed to connect to MongoDB:', err.message);
    console.error('        Check MONGODB_URI in server/.env and Atlas Network Access (0.0.0.0/0).');
    process.exit(1);
  });
