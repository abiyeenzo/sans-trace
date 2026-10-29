'use strict';

const { neon } = require('@neondatabase/serverless');

// Public, read-only aggregate: top countries and the most recent one.
module.exports = async function stats(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }
  if (!process.env.DATABASE_URL) return res.status(200).json({ total: 0, top: [], last: null });

  try {
    const sql = neon(process.env.DATABASE_URL);
    const top = await sql`select country, hits::int as hits from country_stats order by hits desc limit 10`;
    const total = await sql`select coalesce(sum(hits), 0)::int as total from country_stats`;
    const last = await sql`select country, at from last_hit where id = 1`;
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({
      total: total[0].total,
      top,
      last: last[0] ? { country: last[0].country, at: last[0].at } : null,
    });
  } catch (_) {
    return res.status(503).json({ error: 'indisponible' });
  }
};
