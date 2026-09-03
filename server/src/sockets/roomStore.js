// In-memory live room state, backed by MongoDB for persistence/history.
// Rooms are ephemeral (60-minute cap); DB is the durable record.
import Room from '../models/Room.js';

export const MAX_PARTICIPANTS = 3;
export const MAX_FILES = 3;
export const ROOM_MINUTES = 60;
export const ROOM_MS = ROOM_MINUTES * 60 * 1000;

const rooms = new Map(); // code -> live state
const persistTimers = new Map(); // code -> timeout

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function makeCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export const DEFAULT_CODE = `# Welcome to CodeNest! You're coding together in real time.
# Practice Mode: chat + AI tutor enabled. Press "Run" to execute.

def fizzbuzz(n):
    for i in range(1, n + 1):
        if i % 15 == 0:
            print("FizzBuzz")
        elif i % 3 == 0:
            print("Fizz")
        elif i % 5 == 0:
            print("Buzz")
        else:
            print(i)

fizzbuzz(20)
`;

let fileSeq = 1;
export function newFile(name, content = '') {
  return { id: `f${Date.now().toString(36)}${fileSeq++}`, name, content, version: 0 };
}

export async function createRoomDb({ createdByUserId, createdByGuestName }) {
  let code;
  let exists = true;
  while (exists) {
    code = makeCode();
    exists = await Room.exists({ code });
  }
  const now = Date.now();
  return Room.create({
    code,
    createdByUserId: createdByUserId || undefined,
    createdByGuestName: createdByGuestName || '',
    status: 'active',
    mode: 'practice',
    files: [newFile('main.py', DEFAULT_CODE)],
    createdAt: now,
    endsAt: now + ROOM_MS,
  });
}

// Rehydrates live state from the DB after a server restart or when the
// room went empty (state dropped) but is still within its 60-minute window.
export async function getOrCreateState(code) {
  const live = rooms.get(code);
  if (live) return live;
  const doc = await Room.findOne({ code });
  if (!doc || doc.status === 'ended' || Date.now() > doc.endsAt) return null;
  const state = {
    code,
    roomId: doc._id,
    createdAt: doc.createdAt,
    endsAt: doc.endsAt,
    // In-memory learning state is gone once the room empties; always
    // rehydrate into practice mode so the room can never dead-lock.
    mode: 'practice',
    files: doc.files?.length ? doc.files.map((f) => ({ id: f.id, name: f.name, content: f.content, version: f.version || 0 })) : [newFile('main.py', DEFAULT_CODE)],
    participants: [], // {socketId, name, userId, isAdmin, joinedAt, muted}
    chat: [],
    chatbot: [],
    learning: null, // {task, startedAt, endsAt, submitted, result, autoTimer}
  };
  rooms.set(code, state);
  return state;
}

export function getState(code) {
  return rooms.get(code);
}

export function dropState(code) {
  const t = persistTimers.get(code);
  if (t) clearTimeout(t);
  persistTimers.delete(code);
  rooms.delete(code);
}

export function schedulePersist(state) {
  if (!state?.roomId) return;
  const code = state.code;
  const existing = persistTimers.get(code);
  if (existing) clearTimeout(existing);
  persistTimers.set(
    code,
    setTimeout(() => {
      persistTimers.delete(code);
      persistNow(state).catch((e) => console.error(`[room ${code}] persist failed:`, e.message));
    }, 4000)
  );
}

export async function persistNow(state) {
  if (!state?.roomId) return;
  const t = persistTimers.get(state.code);
  if (t) {
    clearTimeout(t);
    persistTimers.delete(state.code);
  }
  await Room.findByIdAndUpdate(state.roomId, {
    mode: state.mode,
    files: state.files.map((f) => ({ id: f.id, name: f.name, content: f.content, version: f.version })),
    learningTaskTitle: state.learning?.task?.title || '',
  });
}

export async function endRoom(state, reason) {
  if (state.learning?.autoTimer) clearTimeout(state.learning.autoTimer);
  dropState(state.code);
  if (state.roomId) {
    await Room.findByIdAndUpdate(state.roomId, { status: 'ended', endedAt: Date.now(), endedReason: reason, mode: state.mode }).catch(() => {});
  }
}

export function publicState(state) {
  return {
    code: state.code,
    createdAt: state.createdAt,
    endsAt: state.endsAt,
    mode: state.mode,
    files: state.files.map((f) => ({ id: f.id, name: f.name, content: f.content, version: f.version })),
    participants: state.participants.map((p) => ({
      socketId: p.socketId,
      name: p.name,
      isAdmin: p.isAdmin,
      muted: p.muted,
      joinedAt: p.joinedAt,
      isUser: !!p.userId,
    })),
    learning: state.learning
      ? {
          task: state.learning.task,
          startedAt: state.learning.startedAt,
          endsAt: state.learning.endsAt,
          submitted: state.learning.submitted,
          result: state.learning.result,
        }
      : null,
  };
}

export const liveRoomCodes = () => [...rooms.keys()];
