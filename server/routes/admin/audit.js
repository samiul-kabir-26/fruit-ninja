import { Router } from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import * as auditRepo from '../../repositories/auditLog.js';

const router = Router();
router.use(adminAuth);

router.get('/audit-log', (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const logs = auditRepo.list(limit);
  res.json({ logs });
});

export default router;
