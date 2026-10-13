import { Router } from 'express';
import { z } from 'zod';
import { adminAuth } from '../../middleware/adminAuth.js';
import * as settingsRepo from '../../repositories/settings.js';
import * as auditRepo from '../../repositories/auditLog.js';
import * as eventService from '../../services/eventService.js';

const router = Router();
router.use(adminAuth);

router.get('/settings', (req, res) => {
  const settings = settingsRepo.getGameplaySettings();
  res.json(settings);
});

const settingsUpdateSchema = z.object({
  modes: z.object({
    classic: z.object({
      enabled: z.boolean().default(true),
      lives: z.number().min(1).max(5).default(3),
      lifeRecoveryEvery: z.number().min(0).max(1000).default(100)
    }).default({}),
    arcade: z.object({
      enabled: z.boolean().default(true),
      durationSec: z.number().min(30).max(180).default(60),
      bombPenalty: z.number().min(0).max(50).default(10),
      specialChance: z.number().min(0).max(0.3).default(0.06),
      criticalChance: z.number().min(0).max(0.2).default(0.02)
    }).default({}),
    zen: z.object({
      enabled: z.boolean().default(true),
      durationSec: z.number().min(30).max(300).default(90)
    }).default({})
  }).default({}),
  physics: z.object({
    gravity: z.number().min(800).max(2400).default(1400),
    minBladeSpeed: z.number().min(300).max(2000).default(900),
    trailLength: z.number().min(5).max(30).default(12),
    bombProbabilityCap: z.number().min(0).max(0.4).default(0.18)
  }).default({}),
  scoring: z.object({
    comboMin: z.number().min(2).max(6).default(3),
    comboBonusPerFruit: z.number().min(0).max(5).default(1)
  }).default({}),
  difficulty: z.array(z.object({
    untilSec: z.number().positive(),
    waveInterval: z.number().positive(),
    minObjects: z.number().int().min(1),
    maxObjects: z.number().int().min(1),
    bombChance: z.number().min(0).max(1)
  })).default([]),
  guestPlayEnabled: z.boolean().default(true)
});

router.put('/settings', (req, res, next) => {
  try {
    const valid = settingsUpdateSchema.parse(req.body);
    const newVersion = settingsRepo.updateGameplaySettings(valid);

    eventService.emit('settings.updated', {
      data: {
        settingsVersion: newVersion,
        changed: Object.keys(req.body)
      }
    });

    auditRepo.log({
      action: 'settings_update',
      target: `v${newVersion}`,
      details: req.body,
      ip: req.ip
    });

    res.json({ ok: true, settingsVersion: newVersion });
  } catch (err) {
    next(err);
  }
});

export default router;
