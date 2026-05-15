import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';

// ─── Token Management ────────────────────────────────────────────────────────

let tokenData = {
  access_token: process.env.STRAVA_ACCESS_TOKEN || '',
  refresh_token: process.env.STRAVA_REFRESH_TOKEN || '',
  expires_at: parseInt(process.env.STRAVA_EXPIRES_AT || '0'),
};

async function refreshAccessToken() {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: tokenData.refresh_token,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(data));
  tokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  };
  console.log('🔄 Strava token refreshed');
  return tokenData.access_token;
}

async function getAccessToken() {
  if (Date.now() / 1000 > tokenData.expires_at - 60) {
    return await refreshAccessToken();
  }
  return tokenData.access_token;
}

async function stravaFetch(endpoint, params = {}) {
  const token = await getAccessToken();
  const url = new URL(`https://www.strava.com/api/v3${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Strava API ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── MCP Server + Tools ──────────────────────────────────────────────────────

const server = new McpServer({ name: 'strava-mcp', version: '1.0.0' });

// Athlete profile
server.tool(
  'get_athlete',
  'Get your Strava athlete profile — name, location, follower count, weight, FTP, etc.',
  {},
  async () => {
    const data = await stravaFetch('/athlete');
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// Recent activities
server.tool(
  'get_recent_activities',
  'List your recent Strava activities with type, distance, time, pace, elevation and heart rate.',
  {
    per_page: z.number().min(1).max(100).optional().describe('How many activities to return (default 30, max 100)'),
    page: z.number().optional().describe('Page number for pagination (default 1)'),
    after: z.number().optional().describe('Only activities after this Unix timestamp'),
    before: z.number().optional().describe('Only activities before this Unix timestamp'),
  },
  async ({ per_page, page, after, before }) => {
    const data = await stravaFetch('/athlete/activities', {
      per_page: per_page ?? 30,
      page: page ?? 1,
      after,
      before,
    });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// Single activity detail
server.tool(
  'get_activity',
  'Get full details of a specific activity by ID — splits, gear, kudos, map, segment efforts.',
  {
    id: z.string().describe('The Strava activity ID (visible in the URL on strava.com)'),
  },
  async ({ id }) => {
    const data = await stravaFetch(`/activities/${id}`, { include_all_efforts: true });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// Athlete stats
server.tool(
  'get_athlete_stats',
  'Get all-time totals, year-to-date, and recent 4-week stats for runs, rides, and swims.',
  {},
  async () => {
    const athlete = await stravaFetch('/athlete');
    const data = await stravaFetch(`/athletes/${athlete.id}/stats`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// Activity zones (HR / power)
server.tool(
  'get_activity_zones',
  'Get heart rate and power zone distribution for a specific activity.',
  {
    id: z.string().describe('The Strava activity ID'),
  },
  async ({ id }) => {
    const data = await stravaFetch(`/activities/${id}/zones`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// Laps
server.tool(
  'get_activity_laps',
  'Get lap-by-lap breakdown (pace, HR, elapsed time) for a specific activity.',
  {
    id: z.string().describe('The Strava activity ID'),
  },
  async ({ id }) => {
    const data = await stravaFetch(`/activities/${id}/laps`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// Kudoers
server.tool(
  'get_activity_kudoers',
  'See who gave kudos on a specific activity.',
  {
    id: z.string().describe('The Strava activity ID'),
  },
  async ({ id }) => {
    const data = await stravaFetch(`/activities/${id}/kudos`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// Starred segments
server.tool(
  'get_starred_segments',
  'Get your starred Strava segments with PR times and leaderboard info.',
  {},
  async () => {
    const data = await stravaFetch('/segments/starred');
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// Segment effort leaderboard
server.tool(
  'get_segment_leaderboard',
  'Get the leaderboard for a specific segment — your rank vs. others.',
  {
    id: z.string().describe('The Strava segment ID'),
  },
  async ({ id }) => {
    const data = await stravaFetch(`/segments/${id}/leaderboard`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// Gear detail
server.tool(
  'get_gear',
  'Get details about a piece of gear (shoes or bike) — total distance logged.',
  {
    id: z.string().describe('Gear ID (e.g. g123456 for bike, a123456 for shoes)'),
  },
  async ({ id }) => {
    const data = await stravaFetch(`/gear/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── Express + SSE Transport ─────────────────────────────────────────────────

const app = express();
const transports = {};

// MCP SSE connection endpoint
app.get('/sse', async (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  res.on('close', () => {
    delete transports[transport.sessionId];
    console.log(`Session ${transport.sessionId} closed`);
  });
  console.log(`New MCP session: ${transport.sessionId}`);
  await server.connect(transport);
});

// MCP message endpoint
app.post('/messages', express.json(), async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (!transport) return res.status(404).json({ error: 'Session not found' });
  await transport.handlePostMessage(req, res);
});

// ─── OAuth Flow ───────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.send(`
    <html><body style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:0 20px">
      <h1>🚴 Strava MCP Server</h1>
      <p>Status: <strong style="color:green">Running</strong></p>
      ${tokenData.access_token
        ? '<p>✅ Strava is connected.</p>'
        : `<p>⚠️ Not connected yet. <a href="/auth">Connect Strava →</a></p>`}
      <hr>
      <p>MCP URL for Claude: <code>${process.env.PUBLIC_URL || 'https://your-app.railway.app'}/sse</code></p>
    </body></html>
  `);
});

app.get('/auth', (req, res) => {
  const redirectUri = `${process.env.PUBLIC_URL}/callback`;
  const authUrl =
    `https://www.strava.com/oauth/authorize` +
    `?client_id=${process.env.STRAVA_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=read,activity:read_all,profile:read_all`;
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.send(`<h2>Error: ${error}</h2>`);

  const tokenRes = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });
  const data = await tokenRes.json();

  if (!data.access_token) {
    return res.send(`<h2>Error exchanging code</h2><pre>${JSON.stringify(data, null, 2)}</pre>`);
  }

  // Update in-memory tokens (will be lost on restart — add env vars below)
  tokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  };

  res.send(`
    <html><body style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:0 20px">
      <h1>✅ Strava Connected!</h1>
      <p>Welcome, <strong>${data.athlete?.firstname} ${data.athlete?.lastname}</strong>!</p>
      <p>To persist your login across restarts, add these to your environment variables in Railway/Render:</p>
      <pre style="background:#f4f4f4;padding:16px;border-radius:8px">STRAVA_ACCESS_TOKEN=${data.access_token}
STRAVA_REFRESH_TOKEN=${data.refresh_token}
STRAVA_EXPIRES_AT=${data.expires_at}</pre>
      <p><a href="/">← Back to home</a></p>
    </body></html>
  `);
});

// ─── Start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Strava MCP server running on port ${PORT}`);
  console.log(`   Home:    http://localhost:${PORT}`);
  console.log(`   MCP URL: http://localhost:${PORT}/sse`);
});
