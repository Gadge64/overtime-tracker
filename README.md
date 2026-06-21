# Overtime Tracker — SMC Shift Team

Fair overtime allocation for the AirNav Ireland SMC shift team.
Replaces a first-come-first-served WhatsApp approach.

## How it works

- A supervisor posts an OT opportunity on the **Post OT** tab
- The **Board** tab shows a priority list (lowest score = first in line)
- Everyone taps Yes or No for themselves — no racing required
- When the window closes, the supervisor taps **Award** and the highest-priority Yes-responder gets the shift (+1 to their score)
- Immediate/emergency cover is first-come-first-served and doesn't affect scores

---

## Stack

- **Frontend:** React 18 + Vite 5
- **Backend:** Supabase (Postgres + Realtime websockets)
- **Hosting:** Vercel (or any static host)

---

## Project structure

```
overtime-tracker/
├── supabase/
│   └── schema.sql        ← Run this in Supabase to set up the DB
├── public/
│   ├── manifest.json     ← PWA manifest (Add to Home Screen)
│   ├── sw.js             ← Service worker (offline / installability)
│   └── icon.svg          ← App icon
├── src/
│   ├── main.jsx          ← React entry point + SW registration
│   ├── supabase.js       ← Supabase client (reads from .env)
│   ├── styles.css        ← All shared CSS
│   ├── App.jsx           ← Auth gate, data fetching, realtime, actions
│   ├── Board.jsx         ← Priority board + active OT responding
│   ├── PostOT.jsx        ← Post new OT form
│   ├── History.jsx       ← Past offers list
│   └── Setup.jsx         ← Team management, score reset
├── index.html
├── vite.config.js
├── vercel.json           ← Vercel SPA routing config
├── .env.example          ← Copy this to .env and fill in Supabase values
└── package.json
```

---

## First-time setup

### 1. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account + new project
2. In the dashboard, go to **SQL Editor → New query**
3. Paste the contents of `supabase/schema.sql` and click **Run**
4. Go to **Database → Replication** and enable Realtime for all three tables

### 2. Get your credentials

In the Supabase dashboard, go to **Settings → API**. You need:
- **Project URL** (looks like `https://xxxx.supabase.co`)
- **anon public** key

### 3. Configure the app

```bash
cp .env.example .env
```

Open `.env` and fill in your values:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run locally

```bash
npm install
npm run dev
```

---

## Deployment (Vercel — recommended)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → import your repo
3. Add your environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy — Vercel auto-detects Vite and builds correctly

The `vercel.json` file handles SPA routing (all paths serve `index.html`).

---

## Installing to phone (PWA)

Once deployed:

**Android (Chrome):** Open the site → tap ⋮ menu → "Add to Home Screen"

**iOS (Safari):** Open the site → tap Share button → "Add to Home Screen"

The app will install like a native app with its own icon.

---

## Team roster

Edit the `defaultTeam` seed in `supabase/schema.sql` before running it,
or use the **Setup** tab in the app to add/rename/remove members after launch.

Current default roster (AirNav SMC initials):
`GD, BR, PMc, JM, PM, GR, RH, DS, MM, BM, AM, AB, PL, SC, SH`

Note: `PMc` = P. McMahon, disambiguated from `PM` = P. Murphy.

---

## Scoring rules

| Event | Score change |
|---|---|
| Awarded a shift | +1 |
| Declined (No) | 0 |
| Didn't respond | 0 |
| Immediate cover | 0 (first-come-first-served, no score tracking) |

Lower score = higher priority for the next planned OT offer.
Tiebreaker: whoever did OT least recently goes first.
Reset scores via the Setup tab every ~3 months.

---

## Response windows

| Time until shift | Window length |
|---|---|
| 48+ hours away | 24 hours |
| 24–48 hours away | 12 hours |
| Under 24 hours away | 4 hours |
| Immediate | No window — first to respond wins |

---

## Notifications

Browser notifications fire when a new OT offer is posted, **as long as the
tab is open**. The browser will ask for permission on first load — tap Allow.

True push notifications (when the browser is closed) would need a push
service (VAPID keys + a server to send pushes). That's a natural next step
if the team finds they're missing offers.

---

## Auth model

No passwords. Each device picks a name from the team list on first visit,
stored in localStorage. This is appropriate for a shared internal tool.

If you need stricter access (e.g. only supervisors can post/award), the
cleanest path is Supabase Auth with email magic links and tightening the
Row Level Security policies in `schema.sql`.
