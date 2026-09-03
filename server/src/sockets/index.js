// Socket.io core: room join/leave, real-time code sync, cursors, files,
// chat, WebRTC signaling relay, admin controls, Learning Mode lifecycle.
import Submission from '../models/Submission.js';
import { generateTask, evaluateSolution } from '../services/geminiService.js';
import { fallbackTask, FALLBACK_EVALUATION } from '../data/fallbackTasks.js';
import {
  getOrCreateState,
  getState,
  dropState,
  persistNow,
  schedulePersist,
  endRoom,
  publicState,
  newFile,
  MAX_PARTICIPANTS,
  MAX_FILES,
  ROOM_MS,
} from './roomStore.js';

const ALLOWED_MINUTES = [5, 10, 15, 20];

function bad(ack, msg) {
  if (typeof ack === 'function') ack({ ok: false, error: msg });
}

export function initSockets(io) {
  // Periodic cleanup: expire active rooms past their 60-minute cap.
  setInterval(async () => {
    for (const code of [...io.sockets.adapter.rooms.keys()]) {
      if (!/^[A-Z0-9]{6}$/.test(code)) continue;
      const state = getState(code);
      if (state && Date.now() > state.endsAt) {
        io.to(code).emit('room:expired');
        await endRoom(state, 'expired').catch(() => {});
      }
    }
  }, 15000).unref();

  io.on('connection', (socket) => {
    socket.data.roomCode = null;

    const inRoom = () => {
      const code = socket.data.roomCode;
      return { code, state: code ? getState(code) : null };
    };

    socket.on('room:join', async ({ code, name, userId }, ack) => {
      try {
        const rc = String(code || '').trim().toUpperCase();
        const nm = String(name || '').trim().slice(0, 40);
        if (!/^[A-Z0-9]{6}$/.test(rc)) return bad(ack, 'Invalid room code');
        if (!nm) return bad(ack, 'Please provide your name');

        const state = await getOrCreateState(rc);
        if (!state) return bad(ack, 'Room not found, full history ended, or expired.');
        if (state.participants.length >= MAX_PARTICIPANTS) return bad(ack, `Room is full (max ${MAX_PARTICIPANTS} coders).`);

        // rejoin of a dropped socket (e.g. refresh): remove stale entry with same name
        state.participants = state.participants.filter((p) => p.socketId !== socket.id);

        const isAdmin = state.participants.length === 0;
        state.participants.push({
          socketId: socket.id,
          name: nm,
          userId: userId || null,
          isAdmin,
          joinedAt: Date.now(),
          muted: false,
        });
        socket.data.roomCode = rc;
        socket.data.name = nm;
        socket.join(rc);

        if (typeof ack === 'function') ack({ ok: true, state: publicState(state), you: socket.id });
        socket.emit('chat:history', state.chat.slice(-60));
        io.to(rc).emit('room:participants', publicState(state).participants);
        socket.to(rc).emit('room:peer-joined', { socketId: socket.id, name: nm }); // WebRTC trigger
        systemChat(io, rc, `${nm} joined the nest${isAdmin ? ' (room admin)' : ''}`);
      } catch (e) {
        console.error('[socket] join failed:', e.message);
        bad(ack, 'Could not join room. Please retry.');
      }
    });

    socket.on('room:leave', async () => {
      await handleLeave(io, socket, 'left');
    });

    // ---- real-time code sync (versioned full-document, fine for <=3 users) ----
    socket.on('code:change', ({ fileId, content }) => {
      const { code, state } = inRoom();
      if (!state) return;
      const file = state.files.find((f) => f.id === fileId);
      if (!file || typeof content !== 'string' || content.length > 100_000) return;
      file.content = content;
      file.version += 1;
      socket.to(code).emit('code:changed', { fileId, content, version: file.version, by: socket.id, name: socket.data.name });
      schedulePersist(state);
    });

    socket.on('cursor:update', ({ fileId, line }) => {
      const { code } = inRoom();
      if (!code || !Number.isFinite(line)) return;
      socket.to(code).emit('cursor:updated', { fileId, line: Number(line), socketId: socket.id, name: socket.data.name });
    });

    // ---- files (max 3 per room) ----
    socket.on('file:create', ({ name }, ack) => {
      const { code, state } = inRoom();
      if (!state) return bad(ack, 'Not in a room');
      if (state.files.length >= MAX_FILES) return bad(ack, `Maximum ${MAX_FILES} files per room.`);
      let fname = String(name || '').trim().slice(0, 40);
      if (!fname) return bad(ack, 'File name required');
      if (!fname.endsWith('.py')) fname += '.py';
      if (state.files.some((f) => f.name === fname)) return bad(ack, 'A file with that name already exists.');
      state.files.push(newFile(fname, ''));
      io.to(code).emit('files:changed', { files: publicState(state).files, activeId: state.files[state.files.length - 1].id, by: socket.id });
      schedulePersist(state);
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('file:rename', ({ fileId, name }, ack) => {
      const { code, state } = inRoom();
      if (!state) return bad(ack, 'Not in a room');
      const file = state.files.find((f) => f.id === fileId);
      if (!file) return bad(ack, 'File not found');
      let fname = String(name || '').trim().slice(0, 40);
      if (!fname) return bad(ack, 'File name required');
      if (!fname.endsWith('.py')) fname += '.py';
      if (state.files.some((f) => f.name === fname && f.id !== fileId)) return bad(ack, 'A file with that name already exists.');
      file.name = fname;
      io.to(code).emit('files:changed', { files: publicState(state).files, by: socket.id });
      schedulePersist(state);
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('file:delete', ({ fileId }, ack) => {
      const { code, state } = inRoom();
      if (!state) return bad(ack, 'Not in a room');
      if (state.files.length <= 1) return bad(ack, 'A room needs at least one file.');
      const idx = state.files.findIndex((f) => f.id === fileId);
      if (idx === -1) return bad(ack, 'File not found');
      state.files.splice(idx, 1);
      const activeId = state.files[Math.max(0, idx - 1)].id;
      io.to(code).emit('files:changed', { files: publicState(state).files, activeId, by: socket.id });
      schedulePersist(state);
      if (typeof ack === 'function') ack({ ok: true });
    });

    // ---- team chat ----
    socket.on('chat:send', ({ text }, ack) => {
      const { code, state } = inRoom();
      if (!state) return bad(ack, 'Not in a room');
      const msg = String(text || '').trim().slice(0, 500);
      if (!msg) return;
      if (state.mode === 'learning' && !state.learning?.submitted)
        return bad(ack, 'Team chat is disabled during Learning Mode. Focus! 🐦');
      const chatMsg = { name: socket.data.name, text: msg, ts: Date.now(), sid: socket.id };
      state.chat.push(chatMsg);
      if (state.chat.length > 200) state.chat = state.chat.slice(-200);
      io.to(code).emit('chat:message', chatMsg);
    });

    // ---- WebRTC signaling relay (voice + camera) ----
    socket.on('webrtc:signal', ({ to, data }) => {
      if (!to || !data) return;
      io.to(to).emit('webrtc:signal', { from: socket.id, data });
    });

    // ---- admin controls ----
    socket.on('admin:mute', ({ target, muted }) => {
      const { state } = inRoom();
      if (!state) return;
      const me = state.participants.find((p) => p.socketId === socket.id);
      const targetP = state.participants.find((p) => p.socketId === target);
      if (!me?.isAdmin || !targetP || target === socket.id) return;
      targetP.muted = !!muted;
      io.to(target).emit('voice:forceMute', { muted: !!muted, by: me.name });
      io.to(state.code).emit('room:participants', publicState(state).participants);
      systemChat(io, state.code, `Admin ${muted ? 'muted' : 'unmuted'} ${targetP.name}`);
    });

    socket.on('admin:kick', ({ target }) => {
      const { code, state } = inRoom();
      if (!state) return;
      const me = state.participants.find((p) => p.socketId === socket.id);
      const targetP = state.participants.find((p) => p.socketId === target);
      if (!me?.isAdmin || !targetP || target === socket.id) return;
      io.to(target).emit('room:kicked', { by: me.name });
      removeParticipant(io, state, target);
      const targetSocket = io.sockets.sockets.get(target);
      targetSocket?.leave(code);
      targetSocket && (targetSocket.data.roomCode = null);
    });

    socket.on('room:end', async (_d, ack) => {
      const { state } = inRoom();
      if (!state) return bad(ack, 'Not in a room');
      const me = state.participants.find((p) => p.socketId === socket.id);
      if (!me?.isAdmin) return bad(ack, 'Only the room admin can end the session.');
      io.to(state.code).emit('room:ended', { by: me.name });
      await endRoom(state, 'ended by admin').catch(() => {});
      if (typeof ack === 'function') ack({ ok: true });
    });

    // ---- Learning Mode lifecycle ----
    socket.on('learning:start', async ({ topic, difficulty, minutes }, ack) => {
      const { code, state } = inRoom();
      if (!state) return bad(ack, 'Not in a room');
      const me = state.participants.find((p) => p.socketId === socket.id);
      if (!me?.isAdmin) return bad(ack, 'Only the room admin can start Learning Mode.');
      if (state.mode === 'learning' && !state.learning?.submitted) return bad(ack, 'Learning Mode is already active.');
      const mins = ALLOWED_MINUTES.includes(Number(minutes)) ? Number(minutes) : 10;
      const diff = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';

      let task;
      try {
        task = await generateTask({ topic: String(topic || '').slice(0, 120), difficulty: diff });
      } catch (e) {
        console.error('[learning] task generation failed, using fallback:', e.message);
        task = fallbackTask(diff);
      }

      const now = Date.now();
      if (state.learning?.autoTimer) clearTimeout(state.learning.autoTimer);
      state.learning = { task, startedAt: now, endsAt: now + mins * 60000, submitted: false, result: null, autoTimer: null };
      state.mode = 'learning';
      state.chatbot = []; // fresh context for the new task

      // If the room would expire before the task ends, keep room alive until task ends + 2 min buffer.
      if (state.endsAt < state.learning.endsAt + 120000) state.endsAt = state.learning.endsAt + 120000;

      state.learning.autoTimer = setTimeout(() => autoEvaluate(io, code), mins * 60000 + 1500);
      await persistNow(state).catch(() => {});

      const payload = { task, startedAt: now, endsAt: state.learning.endsAt };
      io.to(code).emit('learning:started', payload);
      systemChat(io, code, `Learning Mode started: "${task.title}" (${mins} min). Chat is disabled. Good luck!`);
      if (typeof ack === 'function') ack({ ok: true, learning: payload });
    });

    socket.on('learning:submit', async (_d, ack) => {
      const { code, state } = inRoom();
      if (!state) return bad(ack, 'Not in a room');
      if (state.mode !== 'learning' || !state.learning || state.learning.submitted)
        return bad(ack, 'No active Learning Mode task to submit.');
      const result = await evaluateAndBroadcast(io, state);
      if (typeof ack === 'function') ack({ ok: true, result });
    });

    socket.on('learning:loadStarter', () => {
      const { state } = inRoom();
      if (!state?.learning || state.learning.submitted) return;
      const file = state.files[0];
      if (!file) return;
      file.content = state.learning.task.starterCode || '';
      file.version += 1;
      io.to(state.code).emit('code:changed', {
        fileId: file.id,
        content: file.content,
        version: file.version,
        by: socket.id,
        name: socket.data.name,
      });
    });

    socket.on('disconnect', () => handleLeave(io, socket, 'disconnected', true));
  });

  async function autoEvaluate(io, code) {
    const state = getState(code);
    if (!state?.learning || state.learning.submitted) return;
    await evaluateAndBroadcast(io, state);
  }

  async function evaluateAndBroadcast(io, state) {
    const learning = state.learning;
    learning.submitted = true;
    if (learning.autoTimer) clearTimeout(learning.autoTimer);

    io.to(state.code).emit('learning:evaluating');

    let result;
    try {
      result = await evaluateSolution({
        task: learning.task,
        files: state.files,
        teamSize: state.participants.length,
      });
    } catch (e) {
      console.error('[learning] evaluation failed:', e.message);
      result = FALLBACK_EVALUATION(e.message.slice(0, 80));
    }

    learning.result = result;
    state.mode = 'practice'; // chat re-enabled after evaluation
    await persistNow(state).catch(() => {});

    await Submission.create({
      roomCode: state.code,
      taskTitle: learning.task.title,
      taskDescription: learning.task.description,
      difficulty: learning.task.difficulty,
      score: result.score,
      feedback: result,
      files: state.files.map((f) => ({ name: f.name, content: f.content })),
      participants: state.participants.map((p) => ({ name: p.name, userId: p.userId || undefined })),
    }).catch((e) => console.error('[learning] submission save failed:', e.message));

    io.to(state.code).emit('learning:result', { result, task: learning.task });
    systemChat(io, state.code, `Submission evaluated — Team Score ${result.score}/100. Chat re-enabled.`);
    return result;
  }

  function systemChat(io, code, text) {
    const msg = { name: 'CodeNest', text, ts: Date.now(), system: true };
    const state = getState(code);
    if (state) {
      state.chat.push(msg);
      if (state.chat.length > 200) state.chat = state.chat.slice(-200);
    }
    io.to(code).emit('chat:message', msg);
  }

  function removeParticipant(io, state, socketId) {
    const idx = state.participants.findIndex((p) => p.socketId === socketId);
    if (idx === -1) return;
    const [gone] = state.participants.splice(idx, 1);
    if (gone.isAdmin && state.participants.length > 0) {
      // promote earliest joiner
      const next = state.participants.reduce((a, b) => (a.joinedAt <= b.joinedAt ? a : b));
      next.isAdmin = true;
      systemChat(io, state.code, `${next.name} is now the room admin.`);
    }
    io.to(state.code).emit('room:participants', publicState(state).participants);
    io.to(state.code).emit('room:peer-left', { socketId });
  }

  async function handleLeave(io, socket, reason, silent = false) {
    const code = socket.data.roomCode;
    if (!code) return;
    socket.data.roomCode = null;
    socket.leave(code);
    const state = getState(code);
    if (!state) return;
    removeParticipant(io, state, socket.id);
    if (!silent) systemChat(io, code, `${socket.data.name || 'A coder'} left the room.`);
    if (state.participants.length === 0) {
      // nobody left: persist files and drop live state; room stays rejoinable from DB until it expires
      await persistNow(state).catch(() => {});
      dropState(code);
    }
  }
}
