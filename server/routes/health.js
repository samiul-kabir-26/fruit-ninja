import { Router } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

router.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.get('/readyz', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('SELECT 1 as alive').get();
    if (result && result.alive === 1) {
      return res.status(200).json({ status: 'ready' });
    }
    return res.status(503).json({ status: 'error', message: 'DB check failed' });
  } catch (err) {
    return res.status(503).json({ status: 'error', message: err.message });
  }
});

export default router;
