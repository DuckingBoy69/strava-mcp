# 🚴 Strava MCP Server for Claude

Connect your Strava account to Claude AI. Ask questions about your training, analyse your activities, compare performance over time — all in natural conversation.

---

## What Claude can do with your Strava

- "How many kilometres did I run this month?"
- "What was my average pace on my last 5 runs?"
- "Show me my year-to-date cycling stats"
- "Which activity had my highest heart rate this week?"
- "Break down my lap splits from yesterday's run"
- "What zones did I spend most time in on my last ride?"
- "How many km are on my Nike Vaporfly shoes?"

---

## Setup (15 minutes)

### Step 1 — Create a Strava API App

1. Go to [https://www.strava.com/settings/api](https://www.strava.com/settings/api)
2. Fill in the form:
   - **Application Name:** anything (e.g. "My MCP Server")
   - **Category:** choose any
   - **Club:** leave blank
   - **Website:** use your Railway/Render URL (or `http://localhost:3000` for now)
   - **Authorization Callback Domain:** your Railway/Render domain (or `localhost`)
3. Click **Create** and note your **Client ID** and **Client Secret**

---

### Step 2 — Deploy to Railway (recommended, free tier available)

1. Go to [https://railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Push this code to a GitHub repo and connect it
   - Or use **Railway CLI**: `railway init` then `railway up`
4. In Railway, go to your project → **Variables** and add:
   ```
   STRAVA_CLIENT_ID=your_client_id
   STRAVA_CLIENT_SECRET=your_client_secret
   PUBLIC_URL=https://your-app.up.railway.app
   ```
5. Railway gives you a public URL automatically — note it down

**Alternative: Render.com**
- New Web Service → connect GitHub repo
- Build command: `npm install`
- Start command: `npm start`
- Add the same environment variables

---

### Step 3 — Connect your Strava account

1. Visit `https://your-app.up.railway.app/auth`
2. Authorise the app on Strava
3. You'll see your tokens — copy the three `STRAVA_*` values back into your Railway environment variables
4. Redeploy (Railway does this automatically when you save variables)

---

### Step 4 — Add to Claude

1. Open Claude at [claude.ai](https://claude.ai)
2. Go to **Settings → Integrations** (or the plug icon)
3. Click **Add Integration**
4. Enter your MCP URL: `https://your-app.up.railway.app/sse`
5. Click **Connect**

That's it. Start a new conversation and ask Claude about your Strava!

---

## Available Tools

| Tool | What it does |
|------|-------------|
| `get_athlete` | Your profile — name, location, FTP, weight |
| `get_recent_activities` | List activities with distance, pace, HR, elevation |
| `get_activity` | Full detail of one activity including splits and segments |
| `get_athlete_stats` | All-time, year-to-date, and recent totals |
| `get_activity_zones` | HR and power zone breakdown for an activity |
| `get_activity_laps` | Lap-by-lap splits |
| `get_activity_kudoers` | Who gave kudos |
| `get_starred_segments` | Your starred segments with PRs |
| `get_segment_leaderboard` | Leaderboard for any segment |
| `get_gear` | Distance logged on shoes or bikes |

---

## Example prompts for Claude

```
Analyse my last 4 weeks of running. Am I building volume safely?

What's my longest ride this year and what were the lap splits?

Compare my average pace on morning runs vs evening runs this month.

Which of my bikes has the most km on it?

How has my average heart rate on easy runs changed over the last 3 months?
```

---

## Local development

```bash
npm install
cp .env.example .env
# Fill in .env with your Strava credentials and PUBLIC_URL=http://localhost:3000
npm run dev
# Visit http://localhost:3000/auth to connect Strava
# MCP URL: http://localhost:3000/sse
```

> Note: For local testing with Claude, you'll need a tunnel like [ngrok](https://ngrok.com):  
> `ngrok http 3000` → use the https URL as your MCP URL in Claude.

---

## Token refresh

Strava access tokens expire every 6 hours. This server handles refresh automatically using your `STRAVA_REFRESH_TOKEN`. The refresh token itself is long-lived — you only need to go through OAuth once.
