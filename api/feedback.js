'use strict';

const { neon } = require('@neondatabase/serverless');

const LABELS = new Set(['ai', 'human', 'mixed', 'unknown']);
const LANGS = new Set(['fr', 'en']);
const LEVELS = new Set(['low', 'medium', 'high', 'insufficient']);
const int = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;

// Stores a label the user chose and a few counters. The text itself never reaches the server.
module.exports = async function feedback(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const origin = req.headers.origin;
  if (origin) {
    let host;
    try { host = new URL(origin).host; } catch (_) { return res.status(403).end(); }
    if (host !== req.headers.host) return res.status(403).end();
  }

  const b = req.body && typeof req.body === 'object' ? req.body : null;
  if (!b || !LABELS.has(b.label) || !LANGS.has(b.lang) || !LEVELS.has(b.level) || !int(b.signals, 1000) || !int(b.words, 200000)) {
    return res.status(400).end();
  }
  const helpful = b.helpful === true || b.helpful === false ? b.helpful : null;

  if (!process.env.DATABASE_URL) return res.status(503).end();
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`
      insert into feedback (label, lang, level, signals, words, helpful)
      values (${b.label}, ${b.lang}, ${b.level}, ${b.signals}, ${b.words}, ${helpful})`;
    return res.status(204).end();
  } catch (_) {
    return res.status(503).end();
  }
};
