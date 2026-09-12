const { Redis } = require('@upstash/redis');

const redis = Redis.fromEnv();
const KEY = 'mapendos:tournament:v1';

const REFERENCE_LEFT=[['lele','marcel','rigel'],['gin','jiro','kenan'],['joler','laura','wansu'],['eki','ical','xyn'],['jalu','loak','ales'],['dilan','limz','weldan'],['natan','kairi','kla'],['gaga','aran','jucki'],['depan','showie','jexy'],['caesar','beryl','zar'],['sam','jefrey','goreng']];
const REFERENCE_RIGHT=[['crusher','jepri'],['tatan','mattew'],['moza','kyuzin'],['clay','rey'],['iban','rexpi'],['iponge','jhon'],['cello','dokong'],['torik','memet'],['bons','wisnu'],['febri','eko'],['petrus','robby']];
const referenceTeams=()=>REFERENCE_LEFT.map((a,i)=>({name:`MPD ${String.fromCharCode(65+i)}`,side:'mixed',players:[...a.map(name=>({name,side:'idp'})),...REFERENCE_RIGHT[i].map(name=>({name,side:'ime'}))]})).concat(Array.from({length:5},(_,i)=>({name:`MPD ${String.fromCharCode(76+i)}`,side:'mixed',players:[]})));
const hasPlayers=teams=>Array.isArray(teams)&&teams.some(t=>Array.isArray(t?.players)&&t.players.some(p=>String((typeof p==='object'?p?.name:p)||'').trim()&&p!=='TBD'));

const DEFAULT = {
  teams: Array.from({ length: 16 }, (_, i) => ({
    name: `MPD ${String.fromCharCode(65 + i)}`,
    side: 'mixed',
    players: []
  })),
  bracketOrder: Array.from({ length: 16 }, (_, i) => i),
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key, X-Admin-Password');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      let state = await redis.get(KEY);
      if (!state) {
        state = { ...DEFAULT, teams: referenceTeams(), bracketOrder: Array.from({length:11},(_,i)=>i), updatedAt: new Date().toISOString() };
        await redis.set(KEY, state);
      } else if (!hasPlayers(state.teams)) {
        state = { ...state, teams: referenceTeams(), bracketOrder: Array.from({length:11},(_,i)=>i), updatedAt: new Date().toISOString() };
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

      // Destructive admin actions are handled separately from normal state saves.
      // The password/header check above is mandatory for every destructive action.
      if (body.action === 'reset_all') {
        await redis.del(KEY);
        return res.status(200).json({ ok: true, action: 'reset_all' });
      }

      if (body.action === 'reset_kills') {
        const current = await redis.get(KEY);
        const base = current && typeof current === 'object' ? current : DEFAULT;
        const next = { ...base, killsRanking: { ...DEFAULT.killsRanking }, updatedAt: new Date().toISOString() };
        await redis.set(KEY, next);
        return res.status(200).json({ ok: true, action: 'reset_kills', state: next });
      }

      if (body.action === 'reset_tournament') {
        const current = await redis.get(KEY);
        const base = current && typeof current === 'object' ? current : DEFAULT;
        const next = { ...DEFAULT, live: base.live || { idp: '', ime: '' }, killsRanking: base.killsRanking || { ...DEFAULT.killsRanking }, updatedAt: new Date().toISOString() };
        await redis.set(KEY, next);
        return res.status(200).json({ ok: true, action: 'reset_tournament', state: next });
      }

      if (!body || typeof body !== 'object' || !Array.isArray(body.teams)) {
        return res.status(400).json({ error: 'Invalid tournament state' });
      }

      const rawOrder = Array.isArray(body.bracketOrder) ? body.bracketOrder.map(Number).filter(i => Number.isInteger(i) && i >= 0 && i < 16) : DEFAULT.bracketOrder;
      const bracketOrder = [...new Set(rawOrder)];
      for (let i = 0; i < 16; i++) if (!bracketOrder.includes(i)) bracketOrder.push(i);

      const state = {
        teams: body.teams.slice(0, 16).map((team, i) => ({
          name: `MPD ${String.fromCharCode(65 + i)}`,
          side: 'mixed',
          players: Array.isArray(team.players) ? team.players : []
        })),
        bracketOrder,
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
