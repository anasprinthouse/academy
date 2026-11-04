// Shared helpers for the API (files starting with "_" are not public endpoints on Vercel)
import crypto from 'node:crypto';

export const STATUSES = ['New', 'Contacted', 'Trial scheduled', 'Enrolled', 'Not interested'];
export const COOKIE = 'iqa_admin';

// Upstash Redis (Vercel → Storage → Upstash for Redis) — works with either set of variable names
const DB_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const DB_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export function dbReady() {
  return Boolean(DB_URL && DB_TOKEN);
}

export async function redis(...command) {
  const r = await fetch(DB_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + DB_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('Database error: ' + (j.error || r.status));
  return j.result;
}

export function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export function clean(v, max = 200) {
  return String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

// Returns true while under the limit
export async function underLimit(key, max, windowSec) {
  const n = await redis('INCR', key);
  if (n === 1) await redis('EXPIRE', key, windowSec);
  return n <= max;
}

/* ---------- admin session ---------- */
function secret() {
  // Changing ADMIN_PASSWORD signs everyone out automatically
  return (process.env.SESSION_SECRET || 'iqa') + '|' + (process.env.ADMIN_PASSWORD || '');
}
function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}
function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function passwordOk(input) {
  const pw = process.env.ADMIN_PASSWORD || '';
  if (!pw) return false;
  const h = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
  return same(h(input), h(pw));
}

export function makeToken(hours = 12) {
  const exp = String(Date.now() + hours * 3600e3);
  return exp + '.' + sign(exp);
}

export function tokenOk(token) {
  if (!token || !token.includes('.')) return false;
  const [exp, sig] = token.split('.');
  return same(sig, sign(exp)) && Number(exp) > Date.now();
}

export function getCookie(req, name) {
  const part = String(req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '='));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
}

export function setSession(res, token) {
  const maxAge = token ? 12 * 3600 : 0;
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token ? encodeURIComponent(token) : ''}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
}
