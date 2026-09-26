import pg from 'pg';
const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('No DB URL present');

const pool = new Pool({ connectionString: dbUrl });

pool.on('error', (err: Error) => {
  console.error('DB Client Connection error', err);
});

export { pool };
