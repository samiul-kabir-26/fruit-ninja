import { Router } from 'express';
import { z } from 'zod';
import { ulid } from 'ulid';
import { adminAuth } from '../../middleware/adminAuth.js';
import * as apiKeysRepo from '../../repositories/apiKeys.js';
import * as auditRepo from '../../repositories/auditLog.js';
import { generateApiKey } from '../../services/tokenService.js';

const router = Router();
router.use(adminAuth);

router.get('/api-keys', (req, res) => {
  const keys = apiKeysRepo.list();
  res.json({ keys });
});

const createKeySchema = z.object({
  name: z.string().min(1, 'Key name is required').max(64)
});

router.post('/api-keys', (req, res, next) => {
  try {
    const { name } = createKeySchema.parse(req.body);
    const id = ulid();
    const { plaintext, prefix, hash } = generateApiKey();

    apiKeysRepo.create({
      id,
      name,
      prefix,
      keyHash: hash
    });

    auditRepo.log({
      action: 'api_key_create',
      target: id,
      details: { name, prefix },
      ip: req.ip
    });

    res.status(201).json({
      id,
      name,
      prefix,
      apiKey: plaintext // Shown once!
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/api-keys/:id', (req, res) => {
  apiKeysRepo.revoke(req.params.id);

  auditRepo.log({
    action: 'api_key_revoke',
    target: req.params.id,
    ip: req.ip
  });

  res.json({ ok: true, id: req.params.id });
});

export default router;
