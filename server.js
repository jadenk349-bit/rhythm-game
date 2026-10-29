/* ==============================================================
   RHYTHM GAME — server
   Serves index.html and a shared leaderboard API.

   GET  /api/scores           → top 10 scores
   POST /api/scores           { name, score } → { id, scores }
   POST /api/scores/reset     { passcode }    → { scores: [] }

   Env vars:
     PORT            port to listen on (Render sets this)
     DATABASE_URL    Postgres connection string. If missing, scores are
                     kept in memory (fine for local testing only).
     ADMIN_PASSCODE  passcode required to reset the leaderboard.
   ============================================================== */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT        = process.env.PORT || 3000;
const MAX_SCORE   = 300; // 3 rounds × 100
const MAX_NAME    = 20;
const TOP_N       = 10;
const INDEX_HTML  = path.join(__dirname, 'index.html');

// ── STORAGE ──────────────────────────────────────────────────
// Two interchangeable stores with the same methods: top(), add(), reset().

function memoryStore() {
  let rows = [];
  let nextId = 1;
  return {
    async init() {},
    async top() {
      return rows.slice().sort((a, b) => b.score - a.score || a.id - b.id).slice(0, TOP_N);
    },
    async add(name, score) {
      const id = nextId++;
      rows.push({ id, name, score });
      return id;
    },
    async reset() { rows = []; },
  };
}

function postgresStore(url) {
  const { Pool } = require('pg');
  // Render's external URLs need SSL; its internal URLs (same region) don't.
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes('render.com') ? { rejectUnauthorized: false } : false,
  });
  return {
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS scores (
          id         SERIAL PRIMARY KEY,
          name       TEXT NOT NULL,
          score      INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
    },
    async top() {
      const { rows } = await pool.query(
        'SELECT id, name, score FROM scores ORDER BY score DESC, id ASC LIMIT $1', [TOP_N]);
      return rows;
    },
    async add(name, score) {
      const { rows } = await pool.query(
        'INSERT INTO scores (name, score) VALUES ($1, $2) RETURNING id', [name, score]);
      return rows[0].id;
    },
    async reset() { await pool.query('DELETE FROM scores'); },
  };
}

const store = process.env.DATABASE_URL
  ? postgresStore(process.env.DATABASE_URL)
  : memoryStore();

// ── HELPERS ──────────────────────────────────────────────────

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

/** An error caused by a bad request (sent back as 400 instead of 500). */
function badRequest(msg) {
  const err = new Error(msg);
  err.status = 400;
  return err;
}

/** Read a small JSON object request body (max 1 KB). */
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1024) { reject(badRequest('Body too large')); req.destroy(); }
    });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(data || '{}'); } catch { return reject(badRequest('Invalid JSON')); }
      if (!body || typeof body !== 'object') return reject(badRequest('Expected a JSON object'));
      resolve(body);
    });
    req.on('error', reject);
  });
}

// ── ROUTES ───────────────────────────────────────────────────

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    fs.createReadStream(INDEX_HTML).pipe(res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/healthz') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/scores') {
    return sendJson(res, 200, { scores: await store.top() });
  }

  if (req.method === 'POST' && url.pathname === '/api/scores') {
    const body  = await readJson(req);
    const name  = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_NAME) : '';
    const score = Number(body.score);
    if (!name) return sendJson(res, 400, { error: 'Name is required' });
    if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
      return sendJson(res, 400, { error: `Score must be a whole number from 0 to ${MAX_SCORE}` });
    }
    const id = await store.add(name, score);
    return sendJson(res, 201, { id, scores: await store.top() });
  }

  if (req.method === 'POST' && url.pathname === '/api/scores/reset') {
    const body = await readJson(req);
    const passcode = process.env.ADMIN_PASSCODE;
    if (!passcode) return sendJson(res, 403, { error: 'Reset is disabled: ADMIN_PASSCODE is not set on the server' });
    if (body.passcode !== passcode) return sendJson(res, 403, { error: 'Wrong passcode' });
    await store.reset();
    return sendJson(res, 200, { scores: [] });
  }

  sendJson(res, 404, { error: 'Not found' });
}

// ── START ────────────────────────────────────────────────────

store.init().then(() => {
  http.createServer((req, res) => {
    handle(req, res).catch(err => {
      if (!err.status) console.error(err);
      if (!res.headersSent) sendJson(res, err.status || 500, { error: err.status ? err.message : 'Server error' });
      else res.end();
    });
  }).listen(PORT, () => {
    console.log(`Rhythm Game listening on port ${PORT} (${process.env.DATABASE_URL ? 'Postgres' : 'in-memory'} scores)`);
  });
}).catch(err => {
  console.error('Could not connect to the database:', err);
  process.exit(1);
});
