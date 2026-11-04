// Admin endpoint: /api/admin?action=login|logout|list|update|delete
import {
  STATUSES, COOKIE, dbReady, redis, readBody, clean, clientIp, underLimit,
  passwordOk, makeToken, tokenOk, getCookie, setSession,
} from './_lib.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const action = String(req.query.action || '');
  const post = req.method === 'POST';

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(503).json({ ok: false, error: 'Admin password is not set. In Vercel open Settings → Environment Variables, add ADMIN_PASSWORD, then redeploy.' });
  }
  if (!dbReady()) {
    return res.status(503).json({ ok: false, error: 'Database is not connected. In Vercel open Storage, connect Upstash for Redis to this project, then redeploy.' });
  }

  try {
    if (action === 'login' && post) {
      if (!(await underLimit('rl:login:' + clientIp(req), 10, 900))) {
        return res.status(429).json({ ok: false, error: 'Too many attempts. Try again in 15 minutes.' });
      }
      if (!passwordOk(readBody(req).password)) {
        return res.status(401).json({ ok: false, error: 'Wrong password.' });
      }
      setSession(res, makeToken());
      return res.status(200).json({ ok: true });
    }

    if (action === 'logout' && post) {
      setSession(res, '');
      return res.status(200).json({ ok: true });
    }

    if (!tokenOk(getCookie(req, COOKIE))) {
      return res.status(401).json({ ok: false, error: 'signin' });
    }

    if (action === 'list' && req.method === 'GET') {
      const flat = (await redis('HGETALL', 'admissions')) || [];
      const rows = [];
      for (let i = 1; i < flat.length; i += 2) {
        try { rows.push(JSON.parse(flat[i])); } catch { /* skip broken row */ }
      }
      return res.status(200).json({ ok: true, rows });
    }

    if (action === 'update' && post) {
      const b = readBody(req);
      const id = clean(b.id, 20);
      const cur = await redis('HGET', 'admissions', id);
      if (!cur) return res.status(404).json({ ok: false, error: 'This admission no longer exists. Refresh the list.' });
      const row = JSON.parse(cur);
      if (b.status !== undefined) {
        if (!STATUSES.includes(b.status)) return res.status(400).json({ ok: false, error: 'Unknown status.' });
        row.status = b.status;
      }
      if (b.notes !== undefined) row.notes = clean(b.notes, 2000);
      row.updated = new Date().toISOString();
      await redis('HSET', 'admissions', id, JSON.stringify(row));
      return res.status(200).json({ ok: true, updated: row.updated });
    }

    if (action === 'delete' && post) {
      await redis('HDEL', 'admissions', clean(readBody(req).id, 20));
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: 'Unknown action.' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
