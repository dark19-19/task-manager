// backend/src/app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db/pool.js';
import { initDb } from './db/init.js';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

// ---------- CORS ----------
// In dev, allow localhost:3000 (the static frontend server).
// In prod, same-origin, so CORS isn't needed — but we keep a permissive
// config anyway, which is fine for this app.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow non-browser requests (curl, server-to-server) — no origin
      if (!origin) return cb(null, true);
      // In dev, allow everything localhost
      if (!isProd && /^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
      // In prod, check the allowlist
      if (allowedOrigins.includes(origin)) return cb(null, true);
      // Same-origin requests often have no origin header or the deployed origin
      if (isProd && !allowedOrigins.length) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json());

// ---------- Health check ----------
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json({
      status: 'ok',
      message: 'Task Manager API is running',
      db_time: result.rows[0].now,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Health DB error:', err);
    res.status(500).json({ status: 'error', message: 'DB unreachable' });
  }
});

// ---------- API routes ----------
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

// ---------- Serve frontend in production ----------
if (isProd) {
  // The frontend folder sits one level up from backend/
  const frontendPath = path.resolve(__dirname, '../../frontend');
  console.log('📦 Serving static frontend from:', frontendPath);

  app.use(express.static(frontendPath));

  // SPA fallback: any non-API GET returns index.html
  // (We don't have real client-side routing, but this is future-proof.)
  app.get(/^(?!\/api|\/health).*/, (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// ---------- 404 (API only in prod; in dev it catches everything) ----------
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ---------- Error handler ----------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// ---------- Start ----------
async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Connected to PostgreSQL');
    await initDb();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🌍 Mode: ${isProd ? 'production' : 'development'}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();