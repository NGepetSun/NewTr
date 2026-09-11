const { Redis } = require('@upstash/redis');

const redis = Redis.fromEnv();
const KEY = 'mapendos:tournament:v1';

const DEFAULT = {
  teams: Array.from({ length: 16 }, (_, i) => ({
    name: `MPD ${String.fromCharCode(65 + i)}`,
    side: 'mixed',
    players: []
  })),
  scores: {},
  winners: {},
  live: { idp: '', ime: '' },
  banned: [],
  killsRanking: { matchLabel:'ALL MATCHES', weekLabel:'WEEK 1', seasonLabel:'REGULAR SEASON', matches:[] },
  updatedAt: null
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      let state = await redis.get(KEY);
      if (!state) {
        state = { ...DEFAULT, updatedAt: new Date().toISOString() };
        await redis.set(KEY, state);
      }
      return res.status(200).json(state);
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

      if (body.action === 'auth') {
        const configuredPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_KEY;
        if (!configuredPassword) return res.status(500).json({ error: 'ADMIN_PASSWORD is not configured' });
        if (String(body.password || '') !== String(configuredPassword)) return res.status(401).json({ error: 'Invalid password' });
        return res.status(200).json({ ok: true });
      }

      const configuredKey = process.env.ADMIN_PASSWORD || process.env.ADMIN_KEY;
      if (configuredKey && req.headers['x-admin-password'] !== configuredKey && req.headers['x-admin-key'] !== configuredKey) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!body || typeof body !== 'object' || !Array.isArray(body.teams)) {
        return res.status(400).json({ error: 'Invalid tournament state' });
      }

      const state = {
        teams: body.teams.slice(0, 16).map((team, i) => ({
          name: `MPD ${String.fromCharCode(65 + i)}`,
          side: 'mixed',
          players: Array.isArray(team.players) ? team.players.slice(0, 5) : []
        })),
        scores: body.scores && typeof body.scores === 'object' ? body.scores : {},
        winners: body.winners && typeof body.winners === 'object' ? body.winners : {},
        live: body.live && typeof body.live === 'object' ? body.live : { idp: '', ime: '' },
        banned: Array.isArray(body.banned) ? [...new Set(body.banned.filter(Boolean).map(String))] : [],
        killsRanking: body.killsRanking && typeof body.killsRanking === 'object' ? {
          matchLabel: String(body.killsRanking.matchLabel || 'ALL MATCHES'),
          weekLabel: String(body.killsRanking.weekLabel || 'WEEK 1'),
          seasonLabel: String(body.killsRanking.seasonLabel || 'REGULAR SEASON'),
          matches: Array.isArray(body.killsRanking.matches) ? body.killsRanking.matches.map(m => ({
            matchLabel: String(m?.matchLabel || 'MATCH'),
            entries: Array.isArray(m?.entries) ? m.entries.slice(0,5).map(e => ({
              name: String(e?.name || ''),
              kills: Math.max(0, Math.floor(Number(e?.kills) || 0)),
              team: String(e?.team || ''),
              side: String(e?.side || '')
            })).filter(e => e.name) : []
          })).filter(m => m.entries.length || m.matchLabel) : []
        } : { matchLabel:'ALL MATCHES', weekLabel:'WEEK 1', seasonLabel:'REGULAR SEASON', matches:[] },
        updatedAt: new Date().toISOString()
      };

      while (state.teams.length < 16) {
        const i = state.teams.length;
        state.teams.push({ name: `MPD ${String.fromCharCode(65 + i)}`, side: 'mixed', players: [] });
      }

      await redis.set(KEY, state);
      return res.status(200).json({ ok: true, state });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error' });
  }
};
