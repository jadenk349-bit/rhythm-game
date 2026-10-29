/* ==============================================================
   Writes config.js from environment variables at deploy time.
   Render Static Site → Build Command: node build-config.js

   SUPABASE_URL              e.g. https://abcdefgh.supabase.co
   SUPABASE_PUBLISHABLE_KEY  sb_publishable_… (or the legacy "anon" key)

   The build fails, leaving the previous deploy live, if a variable is
   missing or if a secret / service_role key is supplied by mistake.
   ============================================================== */

const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error('build-config: ' + msg);
  process.exit(1);
}

const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const key = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();

if (!url) fail('SUPABASE_URL is not set');
if (!key) fail('SUPABASE_PUBLISHABLE_KEY is not set');
if (!/^https:\/\/[^/]+$/.test(url)) fail('SUPABASE_URL must look like https://<project>.supabase.co (no path)');

// Never publish a key that bypasses Row Level Security
if (key.startsWith('sb_secret_')) fail('that is a SECRET key — use the publishable key (sb_publishable_…)');
if (key.split('.').length === 3) {
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (payload.role && payload.role !== 'anon') fail(`that key has role "${payload.role}" — use the publishable/anon key`);
  } catch (e) {
    if (e && e.message && e.message.startsWith('build-config')) throw e;
  }
}

const out = path.join(__dirname, 'config.js');
fs.writeFileSync(out, `window.SUPABASE_CONFIG = ${JSON.stringify({ url, key })};\n`);
console.log(`build-config: wrote config.js for ${url}`);
