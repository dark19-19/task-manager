// backend/src/db/init.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initDb() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('✅ Database schema ensured');
}

// Allow running this file directly: `node src/db/init.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  initDb()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Failed to init DB:', err);
      process.exit(1);
    });
}