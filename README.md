# 🪺 CodeNest

**Collaborate. Code. Conquer with AI!**

CodeNest is an AI-powered collaborative Python learning environment — up to **3 coders** share a real-time editor with **3 files**, team **chat + voice/video**, a **RAG AI tutor** (Google Gemini) that reads your live code, and a **Learning Mode** where AI generates timed tasks and evaluates the team's solution with a score out of 100.

Built as a Final Year Project. Full stack: React + Vite + Monaco, Node.js + Express + Socket.io, MongoDB, Gemini API, Pyodide (in-browser Python), WebRTC.

---

## Features

| Feature | How it works |
|---|---|
| 🏠 Landing page | Enter your name → create a room or join with a 6-char code |
| 👥 Real-time collaboration | Live code sync, remote cursor highlights, presence avatars (max 3 coders) |
| 📄 Multi-file | Up to 3 Python files per room with tabs (create / rename / delete) |
| 💬 Team chat | Socket.io chat with system messages; locked during Learning Mode |
| 🎙️ Voice & camera | Peer-to-peer WebRTC mesh with mute controls |
| 🤖 RAG chatbot | Gemini answers grounded in your live code, with line-specific feedback |
| 💡 AI Hints toggle | Inline gutter hints in the editor, refreshed as you type |
| 🎓 Learning Mode | Admin picks topic/difficulty/duration → AI generates a timed task → chat locks → submit → AI scores the team /100 with strengths & improvements |
| ▶️ Run Python | Secure in-browser execution via Pyodide (no server-side execution) |
| 👑 Admin controls | Room creator can mute/remove coders, start/end Learning Mode, end session |
| 📊 Results dashboard | Every evaluation saved to MongoDB — scores, feedback, submitted code |
| ⏱ 60-minute cap | Enforced server-side; rooms auto-expire |

## Tech stack

- **Frontend:** React 18 + Vite, Monaco Editor, TailwindCSS, socket.io-client, Pyodide (Web Worker)
- **Backend:** Node.js + Express, Socket.io, JWT auth (bcrypt), Helmet + rate limiting
- **Database:** MongoDB Atlas (Mongoose)
- **AI:** Google Gemini API (`gemini-3.6-flash`, with automatic model fallback)
- **Deploy:** single Render.com web service (serves the built React app + API + sockets)

---

## Run it locally (5 minutes)

**You need:** [Node.js 20+](https://nodejs.org) installed.

```bash
# 1. install dependencies (root install covers client + server)
npm install

# 2. create your env file — copy .env.example to server\.env and fill in:
#    MONGODB_URI, GEMINI_API_KEY, JWT_SECRET
#    (see ".env.example" comments for where to get each)

# 3. start both servers
npm run dev
```

- App: **http://localhost:5173**
- API: **http://localhost:5000/api/health**

### Useful checks

```bash
npm run test:keys   # verifies your Gemini key + MongoDB connection
node scripts/test-sync.mjs   # 17-check multi-user real-time test suite (server must be running)
```

> Tip: to test collaboration solo, open the room in **two browser tabs** (or a normal + incognito window) with different names.

---

## 🚀 Deploying

Two supported options:

1. **Frontend on Vercel + backend on Render** (matches your proposal's Vercel mention) → follow the full beginner guide in **[DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md)** — includes day-to-day management (updates, rollbacks, secrets, logs, domains, costs).
2. **All-in-one on Render** (single URL, simplest) → use the `render.yaml` blueprint: Render dashboard → New + → Blueprint → pick this repo → add `MONGODB_URI` + `GEMINI_API_KEY` → Apply.

### One-time database setup (both options)

- **MongoDB Atlas network access** — Atlas dashboard: *Network Access → Add IP Address → Allow access from anywhere* (`0.0.0.0/0`).
- **Get your Atlas URI** — Atlas → *Connect → Drivers*. Use the standard `mongodb+srv://...` string and add the database name before the `?`: `...mongodb.net/codenest?retryWrites=true&w=majority`

### Option 2 in detail — all-in-one Render

1. **Put the project on GitHub** (already initialized locally — create an empty repo on GitHub, then):
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/codenest.git
   git branch -M main
   git push -u origin main
   ```
   Your `server/.env` is git-ignored — **your secrets never upload**. ✅

2. **Create the service on Render**
   - Sign up at [render.com](https://render.com) with GitHub → **New + → Blueprint** → select your `codenest` repo → **Apply**.
   - Render reads `render.yaml` (build + start commands come pre-configured).

3. **Add your secrets** — in the service → *Environment*:
   | Key | Value |
   |---|---|
   | `MONGODB_URI` | your Atlas URI (from setup step 2) |
   | `GEMINI_API_KEY` | your Google AI Studio key |
   | `JWT_SECRET` | any long random string (auto-generated if you used the Blueprint) |

4. **Deploy** — Render builds and starts the site at `https://codenest-xxxx.onrender.com`. First build takes ~5 minutes.

5. **Verify** — open the URL, create a room, open it in a second device/tab and code together. 🎉

### Good to know (free tier)

- Render free services **sleep after ~15 min idle**; the first visitor waits ~50 s for a wake-up. Keep the tab open during your demo, or upgrade to a paid plan for always-on.
- HTTPS is automatic — required for microphone/camera on the deployed site.
- Voice connects peer-to-peer via STUN. On most home/campus Wi-Fi it just works; a few strict corporate NATs would need a TURN server (e.g. Cloudflare Calls TURN, free tier available) — not needed for a typical demo.

---

## Project structure

```
codenest/
├── client/                 # React app (Vite)
│   └── src/
│       ├── pages/          # Landing, Dashboard, Room, Results
│       ├── components/     # CodeEditor, FileTabs, ChatPanel, ChatbotPanel,
│       │                   # LearningPanel, VoicePanel, ConsolePanel, AuthModal
│       ├── hooks/          # usePyodide (Python runtime), useVoice (WebRTC)
│       └── workers/        # pyWorker.js — sandboxed Python execution
├── server/                 # Express + Socket.io
│   └── src/
│       ├── routes/         # auth, rooms, ai
│       ├── sockets/        # roomStore.js (live rooms) + index.js (all real-time logic)
│       ├── services/       # geminiService.js (chat, hints, tasks, evaluation)
│       ├── models/         # User, Room, Submission
│       └── middleware/     # JWT auth
├── scripts/                # test-keys.mjs, test-sync.mjs
├── render.yaml             # Render blueprint
└── .env.example            # template for server/.env
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `querySrv ECONNREFUSED` when starting locally | Your router blocks SRV DNS — use the direct-hosts URI from `.env.example` comments (Render is unaffected) |
| "AI assistant is unavailable" / hints missing | Gemini rate limit or overload — the server retries and falls back to other models automatically; wait a moment and retry. Learning Mode tasks fall back to a built-in set so demos never break |
| Voice won't connect between two networks | Check mic permission; strict NATs need a TURN server (see deploy notes) |
| Render site cold-starts slowly | Normal free-tier behavior after 15 min idle |
| `input()` doesn't work in Run | Browser Python has no stdin — tasks are print/return based by design |

---

Made with 💜 — *Collaborate. Code. Conquer with AI!*
