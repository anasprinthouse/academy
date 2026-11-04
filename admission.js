// Public endpoint: the website's admission form posts here
import crypto from 'node:crypto';
import { dbReady, redis, readBody, clean, clientIp, underLimit } from './_lib.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST' });
  if (!dbReady()) return res.status(503).json({ ok: false, error: 'Database not connected' });

  const d = readBody(req);
  if (d.website) return res.status(200).json({ ok: true }); // hidden spam-trap field was filled

  const name = clean(d.name, 80);
  const phone = clean(d.phone, 30);
  if (!name || !phone) return res.status(400).json({ ok: false, error: 'Name and WhatsApp number are required' });

  try {
    if (!(await underLimit('rl:adm:' + clientIp(req), 8, 3600))) {
      return res.status(429).json({ ok: false, error: 'Too many forms from this connection. Please message us on WhatsApp.' });
    }
    const now = new Date().toISOString();
    const row = {
      id: crypto.randomBytes(5).toString('hex'),
      submitted: now,
      name,
      age: clean(d.age, 3),
      gender: clean(d.gender, 20),
      country: clean(d.country, 60),
      phone,
      course: clean(d.course, 80),
      teacher: clean(d.teacher, 30),
      time: clean(d.time, 30),
      message: clean(d.message, 1500),
      status: 'New',
      notes: '',
      updated: now,
    };
    await redis('HSET', 'admissions', row.id, JSON.stringify(row));
    return res.status(200).json({ ok: true, id: row.id });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
