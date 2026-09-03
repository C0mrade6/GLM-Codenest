# 🚀 Deploying CodeNest — Frontend on Vercel + Backend on Render

This guide takes you from zero to a live site anyone in the world can use, then teaches you how to manage it (updates, fixes, domains, secrets, costs). No prior deployment experience needed — follow the steps in order.

---

## Why two services? (read this first)

CodeNest has two halves:

```
┌─────────────────────────┐         ┌──────────────────────────────┐
│  VERCEL  (frontend)     │  HTTPS  │  RENDER  (backend)           │
│  React app — the UI     │ ──────► │  Express + Socket.io + AI    │
│  what users see         │         │  rooms, chat, Gemini, DB     │
│  codenest.vercel.app    │         │  codenest-api.onrender.com   │
└─────────────────────────┘         └──────────────┬───────────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │  MongoDB Atlas  │
                                          │  your database  │
                                          └─────────────────┘
```

**Vercel cannot host the backend** — its serverless platform doesn't support the persistent WebSocket connections that real-time collaboration (code sync, chat, voice signaling) requires. So the standard architecture (and what your proposal's "Vercel" deployment section describes) is: **static frontend on Vercel, realtime backend on Render**. Both free.

---

## PART 1 — One-time setup (do these once)

### 1.1 Accounts (all free)
- [github.com](https://github.com) → sign up
- [vercel.com](https://vercel.com) → **Continue with GitHub**
- [render.com](https://render.com) → **Sign in with GitHub**

### 1.2 Push the project to GitHub
Open a terminal (cmd/PowerShell) in the project folder and run — replace `YOUR_USERNAME` with your GitHub username:

```bash
cd C:\Users\waqar\Music\FYP\codenest
"C:\Program Files\Git\bin\git.exe" remote add origin https://github.com/YOUR_USERNAME/codenest.git
"C:\Program Files\Git\bin\git.exe" branch -M main
"C:\Program Files\Git\bin\git.exe" push -u origin main
```

(First create the empty repo on GitHub: **+ → New repository** → name `codenest` → Public or Private, either works → **Create**. Do NOT tick "Add README".)

When it asks for login, GitHub no longer accepts passwords — use a **Personal Access Token**: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token → tick `repo` → copy the token and paste it as your password.

✅ Your secrets are safe: `server/.env` is in `.gitignore` and is **not** in the repo.

### 1.3 Let Render reach your database (MongoDB Atlas)
Atlas dashboard → **Network Access** → **+ ADD IP ADDRESS** → type `0.0.0.0/0` (allow from anywhere) → Confirm.
> Needed because Render's servers have dynamic IPs. This is standard for Atlas free tier.

### 1.4 Your two secret values (keep them handy)
| Secret | Where it is |
|---|---|
| `MONGODB_URI` | Atlas → **Connect → Drivers** → copy the `mongodb+srv://...` string, insert `codenest` before the `?` → e.g. `...mongodb.net/codenest?retryWrites=true&w=majority` |
| `GEMINI_API_KEY` | your Google AI Studio key (already in your local `server/.env`) |

---

## PART 2 — Deploy the backend to Render (≈10 min, mostly waiting)

1. Render dashboard → **New + → Web Service**
2. Connect your GitHub account if asked → select the **`codenest`** repo
3. Fill in:
   | Field | Value |
   |---|---|
   | Name | `codenest-api` |
   | Region | Frankfurt (closest to Pakistan) |
   | Branch | `main` |
   | Root Directory | `server` |
   | Runtime | **Node** |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |
4. Click **Advanced → Add Environment Variable** (three times):

   | Key | Value |
   |---|---|
   | `MONGODB_URI` | your Atlas URI from 1.4 |
   | `GEMINI_API_KEY` | your Gemini key |
   | `JWT_SECRET` | any long random text (mash your keyboard, 30+ chars) |
5. **Create Web Service** → wait for the build (2–5 min) until status is **Live**
6. Copy your backend URL from the top: `https://codenest-api.onrender.com`
7. **Test it:** open `https://codenest-api.onrender.com/api/health` in your browser → you should see `{"ok":true,...}` ✅

---

## PART 3 — Deploy the frontend to Vercel (≈3 min)

1. Vercel dashboard → **Add New → Project** → **Import** your `codenest` repo
2. Vercel auto-detects Vite. Change/verify these:
   | Field | Value |
   |---|---|
   | Framework Preset | Vite |
   | Root Directory | `client` ← **important!** click Edit next to it |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
3. Open **Environment Variables** and add **two** (use YOUR Render URL from Part 2, same value in both):

   | Name | Value |
   |---|---|
   | `VITE_API_URL` | `https://codenest-api.onrender.com` |
   | `VITE_SOCKET_URL` | `https://codenest-api.onrender.com` |
4. **Deploy** → wait ~1 min
5. Your site is live at `https://codenest-xxxx.vercel.app` 🎉

---

## PART 4 — Verify everything (2 min)

Open the Vercel URL and check:

- [ ] Landing page loads with "Collaborate. Code. Conquer with AI!"
- [ ] Enter a name → **Create New Room** → room opens with the editor
- [ ] "Python Environment Ready" appears → **▶ Run** prints FizzBuzz output
- [ ] Ask the AI tutor something → it answers (first request may take a few seconds)
- [ ] Open the room URL in an incognito window with a second name → typing syncs live in both windows, chat works
- [ ] Admin starts Learning Mode → task appears, chat locks, submit → team score modal

If something fails → see Troubleshooting at the bottom.

---

# 🛠️ MANAGING YOUR SITE (the future part)

## Making changes & redeploying
Everything deploys **automatically from GitHub** — this is the workflow for life:

```bash
# after editing any file(s) in C:\Users\waqar\Music\FYP\codenest:
"C:\Program Files\Git\bin\git.exe" add -A
"C:\Program Files\Git\bin\git.exe" commit -m "describe what you changed"
"C:\Program Files\Git\bin\git.exe" push
```

- **Frontend changed** (anything in `client/`) → Vercel rebuilds automatically (~1 min)
- **Backend changed** (anything in `server/`) → Render rebuilds automatically (~3 min)
- Both dashboards show the build progress; you get the live URL again after it finishes

## Rolling back a bad deploy
- **Vercel:** Project → Deployments → hover the older good one → **⋯ → Promote to Production**
- **Render:** Service → **Events/History**, or just `git revert` the commit and push again

## Changing environment variables
- **Vercel:** Project → Settings → Environment Variables → edit → **Redeploy** (required to take effect)
- **Render:** Service → Environment → edit → saves + restarts automatically
- **Note:** `VITE_*` variables are baked into the frontend at build time — always redeploy after changing them.

## Rotating your secrets (do this after the FYP demo)
Your MongoDB password and Gemini key were shared in chat during development — generate fresh ones:
1. **MongoDB:** Atlas → Database Access → Edit user → Edit password → new password → update `MONGODB_URI` on Render (replace the password part)
2. **Gemini:** [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → delete old key, create new → update `GEMINI_API_KEY` on Render
3. Never put secrets in git — they live only in `server/.env` (local) and the dashboards (cloud)

## Viewing data (rooms, users, scores)
Atlas → **Browse Collections** → database `codenest`:
- `users` — registered accounts
- `rooms` — every room ever created + its final files
- `submissions` — every Learning Mode evaluation (scores, feedback, code)

Free tier = 512 MB — that's thousands of submissions; no worry for a FYP.

## Logs (when something misbehaves)
- **Render:** Service → **Logs** tab (server errors, Gemini failures, DB problems)
- **Vercel:** Project → **Deployments** → build logs (frontend issues are usually visible in the browser console instead: F12 → Console)
- **Browser:** F12 → Console (frontend) and **Network** tab (failed API calls show in red)

## Sleep behavior & keeping it awake
- **Render free sleeps after ~15 min without traffic**; first visitor then waits ~50 s.
- Before a demo/evaluation: open `https://YOUR-RENDER-URL/api/health` yourself ~2 min early — that wakes it.
- Optional 24/7 keep-awake: [cron-job.org](https://cron-job.org) (free) → create a job pinging `/api/health` every 10 min.
- **Vercel never sleeps** — the frontend itself loads instantly; only the backend wake-up can add the delay.

## Custom domain (optional, looks great on the report)
1. Buy a domain (~$2–10/yr, e.g. from Namecheap/Porkbun)
2. Vercel → Project → Settings → **Domains** → Add → it shows the DNS records to create at your registrar
3. HTTPS certificate is issued automatically

## Costs summary
| Service | Free tier limit | CodeNest usage |
|---|---|---|
| Vercel | generous hobby tier | way under |
| Render | 750 hrs/month, sleeps | 1 small service — fine |
| MongoDB Atlas | 512 MB | thousands of records |
| Gemini API | free daily quota | fine for demos |
| **Total** | **$0** | — |

---

## Troubleshooting

| Symptom | Cause → Fix |
|---|---|
| Vercel site loads but "Connecting to the nest…" forever | `VITE_SOCKET_URL` missing/wrong, or backend asleep → check env vars, hit `/api/health` |
| "AI assistant is unavailable" | Gemini quota/overload → server retries automatically; wait a minute. Check Render logs |
| Render deploy fails at build | check the log — most commonly a missing env var |
| `MongooseServerSelectionError` in Render logs | Atlas Network Access isn't `0.0.0.0/0` yet (step 1.3) |
| Voice doesn't connect | mic permission denied, or both peers on very strict networks → see README TURN note |
| 404 when refreshing a room URL | `client/vercel.json` rewrites missing (it's in the repo — redeploy) |
| Everything was working, now 502 | backend woke up or crashed → Render → Logs; it restarts itself |

---

**One-page recap:** push to GitHub → Render hosts `server/` (+2 secrets) → Vercel hosts `client/` (+2 URL vars pointing at Render) → share the Vercel link with the world.
