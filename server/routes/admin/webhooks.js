import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { ulid } from 'ulid';
import { adminAuth } from '../../middleware/adminAuth.js';
import * as webhooksRepo from '../../repositories/webhooks.js';
import * as auditRepo from '../../repositories/auditLog.js';
import * as eventService from '../../services/eventService.js';
import { encryptSecret, decryptSecret } from '../../services/tokenService.js';
import { isUrlSafe, sendDelivery } from '../../services/webhookService.js';
import { DEFAULT_WEBHOOK_EVENT_TYPES } from '../../shared/eventTypes.js';

const router = Router();
router.use(adminAuth);

router.get('/webhooks', (req, res) => {
  const endpoints = webhooksRepo.listEndpoints();
  res.json({
    endpoints: endpoints.map(e => ({
      id: e.id,
      url: e.url,
      eventTypes: JSON.parse(e.event_types_json || '[]'),
      active: Boolean(e.active),
      lastSeq: e.last_seq,
      consecutiveFailures: e.consecutive_failures,
      disabledReason: e.disabled_reason,
      createdAt: e.created_at,
      updatedAt: e.updated_at
    }))
  });
});

const createEndpointSchema = z.object({
  url: z.string().url(),
  eventTypes: z.array(z.string()).default(DEFAULT_WEBHOOK_EVENT_TYPES),
  active: z.boolean().default(true)
});

router.post('/webhooks', async (req, res, next) => {
  try {
    const data = createEndpointSchema.parse(req.body);

    const safe = await isUrlSafe(data.url);
    if (!safe) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Webhook URL cannot point to internal/private network addresses (SSRF guard)',
          requestId: req.id || null
        }
      });
    }

    const secret = crypto.randomBytes(32).toString('hex');
    const secretEnc = encryptSecret(secret);
    const id = ulid();

    const endpoint = webhooksRepo.createEndpoint({
      id,
      url: data.url,
      eventTypesJson: JSON.stringify(data.eventTypes),
      secretEnc,
      active: data.active ? 1 : 0
    });

    auditRepo.log({
      action: 'webhook_create',
      target: id,
      details: { url: data.url },
      ip: req.ip
    });

    res.status(201).json({
      endpoint: {
        id: endpoint.id,
        url: endpoint.url,
        eventTypes: JSON.parse(endpoint.event_types_json),
        active: Boolean(endpoint.active),
        createdAt: endpoint.created_at
      },
      secret // Shown once!
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/webhooks/:id', async (req, res, next) => {
  try {
    const endpoint = webhooksRepo.getEndpoint(req.params.id);
    if (!endpoint) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Webhook endpoint not found',
          requestId: req.id || null
        }
      });
    }

    const updates = {};
    if (req.body.url) {
      const safe = await isUrlSafe(req.body.url);
      if (!safe) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Webhook URL cannot point to internal/private network addresses',
            requestId: req.id || null
          }
        });
      }
      updates.url = req.body.url;
    }
    if (req.body.eventTypes) {
      updates.event_types_json = JSON.stringify(req.body.eventTypes);
    }
    if (req.body.active !== undefined) {
      updates.active = req.body.active ? 1 : 0;
      if (req.body.active) {
        updates.disabled_reason = null;
        updates.consecutive_failures = 0;
      }
    }

    const updated = webhooksRepo.updateEndpoint(endpoint.id, updates);

    auditRepo.log({
      action: 'webhook_update',
      target: endpoint.id,
      details: updates,
      ip: req.ip
    });

    res.json({
      ok: true,
      endpoint: {
        id: updated.id,
        url: updated.url,
        eventTypes: JSON.parse(updated.event_types_json),
        active: Boolean(updated.active)
      }
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/webhooks/:id', (req, res) => {
  const endpoint = webhooksRepo.getEndpoint(req.params.id);
  if (!endpoint) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
        requestId: req.id || null
      }
    });
  }

  webhooksRepo.deleteEndpoint(endpoint.id);

  auditRepo.log({
    action: 'webhook_delete',
    target: endpoint.id,
    ip: req.ip
  });

  res.json({ ok: true, id: endpoint.id });
});

router.post('/webhooks/:id/rotate-secret', (req, res) => {
  const endpoint = webhooksRepo.getEndpoint(req.params.id);
  if (!endpoint) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
        requestId: req.id || null
      }
    });
  }

  const newSecret = crypto.randomBytes(32).toString('hex');
  const newSecretEnc = encryptSecret(newSecret);
  const oldSecretEnc = endpoint.secret_enc;
  const oldExpiresAt = new Date(Date.now() + 24 * 3600000).toISOString(); // 24h grace

  webhooksRepo.updateEndpoint(endpoint.id, {
    secret_enc: newSecretEnc,
    prev_secret_enc: oldSecretEnc,
    prev_secret_expires_at: oldExpiresAt
  });

  auditRepo.log({
    action: 'webhook_rotate_secret',
    target: endpoint.id,
    ip: req.ip
  });

  res.json({
    ok: true,
    secret: newSecret,
    prevSecretExpiresAt: oldExpiresAt
  });
});

router.post('/webhooks/:id/test', async (req, res) => {
  const endpoint = webhooksRepo.getEndpoint(req.params.id);
  if (!endpoint) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
        requestId: req.id || null
      }
    });
  }

  const testEvent = eventService.emit('webhook.test', {
    data: { message: 'Test delivery from Blade Fruit Admin' }
  });

  const deliveryId = ulid();
  webhooksRepo.createDelivery({
    id: deliveryId,
    endpointId: endpoint.id,
    firstSeq: testEvent.seq,
    lastSeq: testEvent.seq,
    eventCount: 1,
    status: 'pending',
    nextAttemptAt: null
  });

  const delivery = webhooksRepo.getDelivery(deliveryId);
  const success = await sendDelivery(delivery, endpoint);

  res.json({
    ok: true,
    deliveryId,
    delivered: success
  });
});

router.get('/webhooks/:id/deliveries', (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const deliveries = webhooksRepo.getDeliveries(req.params.id, limit);
  res.json({ deliveries });
});

router.post('/webhooks/deliveries/:id/redeliver', async (req, res) => {
  const delivery = webhooksRepo.getDelivery(req.params.id);
  if (!delivery) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Delivery not found',
        requestId: req.id || null
      }
    });
  }

  const endpoint = webhooksRepo.getEndpoint(delivery.endpoint_id);
  if (!endpoint) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
        requestId: req.id || null
      }
    });
  }

  const success = await sendDelivery(delivery, endpoint);

  auditRepo.log({
    action: 'webhook_redeliver',
    target: delivery.id,
    ip: req.ip
  });

  res.json({ ok: true, delivered: success });
});

export default router;
