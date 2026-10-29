'use strict';

const { neon } = require('@neondatabase/serverless');

// Records one visit for the country Vercel derived from the request.
// No IP address, no body, no identifier is read or stored.
module.exports = async function hit(req, res) {
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

  const raw = String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
  const country = /^[A-Z]{2}$/.test(raw) ? raw : 'XX';

  if (!process.env.DATABASE_URL) return res.status(204).end();

  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`
      insert into country_stats (country, hits, last_seen)
      values (${country}, 1, now())
      on conflict (country) do update
        set hits = country_stats.hits + 1, last_seen = now()`;
    await sql`
      insert into last_hit (id, country, at)
      values (1, ${country}, now())
      on conflict (id) do update set country = excluded.country, at = excluded.at`;
    return res.status(204).end();
  } catch (_) {
    return res.status(503).end();
  }
};
