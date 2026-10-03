// backend/src/db/pool.js
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Determine if SSL is needed.
// Cloud providers (Neon, Render, Supabase, Heroku) require SSL.
// Local Postgres does not.
//
// Heuristic:
//   - If DATABASE_URL contains "sslmode=require" → SSL on
//   - If the host is not localhost/127.0.0.1 → SSL on (cloud)
//   - Otherwise → SSL off (local)
function needsSSL(url) {
  if (!url) return false;
  if (/sslmode=require/i.test(url)) return true;

  try {
    // Postgres URLs look like: postgresql://user:pass@host:port/db
    const host = new URL(url).hostname;
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1';
  } catch {
    // If the URL is malformed, err on the safe side
    return true;
  }
}

const useSSL = needsSSL(process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error:', err);
  process.exit(1);
});

console.log(`🔌 DB pool configured (SSL: ${useSSL ? 'on' : 'off'})`);

export default pool;