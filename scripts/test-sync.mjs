// Multi-user real-time sync verification (socket-level end-to-end test).
// Usage: node scripts/test-sync.mjs
import { io } from 'socket.io-client';

const URL = process.env.TEST_URL || 'http://localhost:5000';
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
};

// 1. create a fresh room via the API (as a guest)
const createRes = await fetch(`${URL}/api/rooms`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Tester' }),
});
const { code } = await createRes.json();
console.log(`room created: ${code}`);

const connect = (name) =>
  new Promise((resolve, reject) => {
    const s = io(URL, { transports: ['websocket', 'polling'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
    setTimeout(() => reject(new Error('connect timeout')), 8000);
  });

const A = await connect('A');
const B = await connect('B');

const join = (socket, name) =>
  new Promise((resolve, reject) => {
    socket.emit('room:join', { code, name }, (res) => (res.ok ? resolve(res) : reject(new Error(res.error))));
    setTimeout(() => reject(new Error('join timeout')), 8000);
  });

const joinA = await join(A, 'Alice');
const joinB = await join(B, 'Bob');
check('both users joined', !!joinA.ok && !!joinB.ok);
check('room has 2 files slots default (1 file)', joinA.state.files.length === 1, joinA.state.files.map((f) => f.name).join(','));
check('Alice is admin', joinA.state.participants.find((p) => p.name === 'Alice')?.isAdmin === true);
check('Bob is not admin', joinB.state.participants.find((p) => p.name === 'Bob')?.isAdmin === false);

// 2. presence: both see 2 participants
const participantsA = await new Promise((resolve) => {
  A.once('room:participants', resolve);
  setTimeout(() => resolve(null), 4000);
});
check('presence broadcast shows 2 participants', participantsA?.length === 2, `got ${participantsA?.length}`);

// 3. code sync A -> B
const fileId = joinA.state.files[0].id;
const changed = new Promise((resolve) => {
  B.once('code:changed', (p) => resolve(p));
  setTimeout(() => resolve(null), 4000);
});
A.emit('code:change', { fileId, content: 'print("hello from Alice")' });
const ch = await changed;
check('code sync A->B received', ch?.content === 'print("hello from Alice")');

// 4. code sync B -> A
const changed2 = new Promise((resolve) => {
  A.once('code:changed', (p) => resolve(p));
  setTimeout(() => resolve(null), 4000);
});
B.emit('code:change', { fileId, content: '# bob was here' });
const ch2 = await changed2;
check('code sync B->A received', ch2?.content === '# bob was here');

// 5. chat B -> A
const msg = new Promise((resolve) => {
  A.once('chat:message', (m) => resolve(m));
  setTimeout(() => resolve(null), 4000);
});
B.emit('chat:send', { text: 'lets optimize this loop!' });
const m = await msg;
check('chat B->A received', m?.text === 'lets optimize this loop!' && m?.name === 'Bob');

// 6. file create (max 3)
const filesChanged = new Promise((resolve) => {
  A.once('files:changed', (p) => resolve(p));
  setTimeout(() => resolve(null), 4000);
});
B.emit('file:create', { name: 'utils.py' }, (res) => {
  if (!res.ok) console.log('file:create ack error:', res.error);
});
const fc = await filesChanged;
check('file create broadcast (2 files now)', fc?.files?.length === 2 && fc.files.some((f) => f.name === 'utils.py'));

// 7. cursor broadcast
const cursor = new Promise((resolve) => {
  B.once('cursor:updated', (p) => resolve(p));
  setTimeout(() => resolve(null), 4000);
});
A.emit('cursor:update', { fileId, line: 7 });
const cu = await cursor;
check('cursor sync A->B', cu?.line === 7 && cu?.name === 'Alice');

// 8. Learning Mode: admin generates task, chat locks, submit evaluates
const learningStarted = new Promise((resolve) => {
  B.once('learning:started', (p) => resolve(p));
  setTimeout(() => resolve(null), 60000);
});
A.emit('learning:start', { topic: 'string reversal', difficulty: 'easy', minutes: 5 }, (res) => {
  if (!res.ok) console.log('learning:start ack error:', res.error);
});
const ls = await learningStarted;
check('learning task generated & broadcast', !!ls?.task?.title, ls?.task?.title || '');
check('mode switched to learning', ls?.task ? true : false);

const chatBlocked = await new Promise((resolve) => {
  B.emit('chat:send', { text: 'hello?' }, (res) => resolve(res));
  setTimeout(() => resolve(null), 4000);
});
check('chat blocked in learning mode', chatBlocked && chatBlocked.ok === false, chatBlocked?.error || '');

// solve via code change then submit
B.emit('code:change', { fileId, content: 'def rev(s):\n    return s[::-1]\n\nprint(rev("codenest"))' });
await new Promise((r) => setTimeout(r, 500));
const resultP = new Promise((resolve) => {
  B.once('learning:result', (p) => resolve(p));
  setTimeout(() => resolve(null), 90000);
});
A.emit('learning:submit', {}, (res) => {
  if (!res.ok) console.log('learning:submit ack error:', res.error);
});
const lr = await resultP;
check('evaluation returned', !!lr?.result, `score ${lr?.result?.score ?? 'n/a'}/100`);
check('score is a number 0-100', Number.isFinite(lr?.result?.score) && lr.result.score >= 0 && lr.result.score <= 100);
check('evaluation has summary', !!lr?.result?.summary);

// 9. admin kick
const kicked = new Promise((resolve) => {
  B.once('room:kicked', (p) => resolve(p));
  setTimeout(() => resolve(null), 5000);
});
A.emit('admin:kick', { target: joinB.state.participants.find((p) => p.name === 'Bob')?.socketId || joinA.you });
// find Bob's socket id from latest participants on A
const kickWorked = await kicked;
check('admin kick removes Bob', !!kickWorked, kickWorked ? `by ${kickWorked.by}` : '');

A.disconnect();
B.disconnect();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
