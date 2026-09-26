import express from 'express';
import { pool } from '../db/client.js';

const healthRouter = express.Router();

healthRouter.get('/health', async (_req, res) => {
  try {
    await pool.query('select 1');
    res.status(200).json({ status: 'OK' });
  } catch (error) {
    console.error(`Healthcheck failed.`, error);
    res.status(503).json({ status: 'FAIL' });
  }
});

export { healthRouter };
