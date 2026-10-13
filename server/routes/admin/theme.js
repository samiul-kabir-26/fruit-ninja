import path from 'node:path';
import fs from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { z } from 'zod';
import { adminAuth } from '../../middleware/adminAuth.js';
import * as themeRepo from '../../repositories/theme.js';
import * as mediaRepo from '../../repositories/media.js';
import * as auditRepo from '../../repositories/auditLog.js';
import * as eventService from '../../services/eventService.js';
import { processUpload } from '../../services/mediaService.js';
import { env } from '../../config/env.js';

const router = Router();
router.use(adminAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES }
});

router.get('/theme', (req, res) => {
  const status = req.query.status === 'published' ? 'published' : 'draft';
  const theme = themeRepo.getTheme(status);
  res.json(theme);
});

router.put('/theme/ui', (req, res) => {
  const currentAsset = themeRepo.getThemeAsset('draft', 'ui');
  const currentProps = currentAsset ? JSON.parse(currentAsset.props_json) : {};

  const updatedProps = {
    ...currentProps,
    ...req.body
  };

  themeRepo.upsertThemeAsset('draft', 'ui', 'ui', 1, updatedProps, 0);

  auditRepo.log({
    action: 'theme_update_ui',
    target: 'ui',
    details: req.body,
    ip: req.ip
  });

  res.json({ ok: true, ui: updatedProps });
});

const createObjectSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9._-]+$/, 'Key must be lowercase alphanumeric with dots/dashes'),
  kind: z.enum(['fruit', 'bomb', 'special']).default('fruit'),
  label: z.string().min(1),
  radius: z.number().min(10).max(200).default(42),
  points: z.number().min(0).max(100).default(1),
  spawnWeight: z.number().min(1).max(100).default(10),
  juiceColor: z.string().default('#ffffff'),
  specialType: z.string().optional()
});

router.post('/theme/objects', (req, res, next) => {
  try {
    const data = createObjectSchema.parse(req.body);

    const existing = themeRepo.getThemeAsset('draft', data.key);
    if (existing) {
      return res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: `Object with key "${data.key}" already exists`,
          requestId: req.id || null
        }
      });
    }

    const props = {
      label: data.label,
      radius: data.radius,
      points: data.points,
      spawnWeight: data.spawnWeight,
      juiceColor: data.juiceColor,
      specialType: data.specialType,
      enabled: true,
      imageMediaId: null,
      halfLeftMediaId: null,
      halfRightMediaId: null
    };

    themeRepo.upsertThemeAsset('draft', data.key, data.kind, 0, props, 99);

    auditRepo.log({
      action: 'theme_create_object',
      target: data.key,
      details: data,
      ip: req.ip
    });

    res.status(201).json({ ok: true, key: data.key, props });
  } catch (err) {
    next(err);
  }
});

router.patch('/theme/objects/:key', (req, res) => {
  const asset = themeRepo.getThemeAsset('draft', req.params.key);
  if (!asset) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Object not found in draft theme',
        requestId: req.id || null
      }
    });
  }

  const currentProps = JSON.parse(asset.props_json);
  const updatedProps = {
    ...currentProps,
    ...req.body
  };

  themeRepo.upsertThemeAsset('draft', req.params.key, asset.kind, asset.builtin, updatedProps, asset.sort_order);

  auditRepo.log({
    action: 'theme_update_object',
    target: req.params.key,
    details: req.body,
    ip: req.ip
  });

  res.json({ ok: true, key: req.params.key, props: updatedProps });
});

router.delete('/theme/objects/:key', (req, res) => {
  const asset = themeRepo.getThemeAsset('draft', req.params.key);
  if (!asset) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Object not found in draft theme',
        requestId: req.id || null
      }
    });
  }

  if (asset.builtin) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Built-in objects cannot be deleted, but they can be disabled',
        requestId: req.id || null
      }
    });
  }

  themeRepo.deleteThemeAsset('draft', req.params.key);

  auditRepo.log({
    action: 'theme_delete_object',
    target: req.params.key,
    ip: req.ip
  });

  res.json({ ok: true });
});

router.post('/media', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'No file uploaded',
          requestId: req.id || null
        }
      });
    }

    const slot = req.body.slot || '';
    const result = await processUpload(req.file.buffer, req.file.originalname, slot);

    // If a slot was provided (e.g. "fruit.apple.image", "ui.logo"), automatically attach to draft!
    if (slot) {
      const parts = slot.split('.');
      if (parts[0] === 'ui') {
        const field = parts[1]; // logo, background, etc.
        const asset = themeRepo.getThemeAsset('draft', 'ui');
        const props = asset ? JSON.parse(asset.props_json) : {};
        props[`${field}MediaId`] = result.mediaId;
        themeRepo.upsertThemeAsset('draft', 'ui', 'ui', 1, props, 0);
      } else {
        const objectKey = parts.slice(0, 2).join('.'); // fruit.apple
        const subslot = parts[2] || 'image'; // image, halfLeft, halfRight
        const asset = themeRepo.getThemeAsset('draft', objectKey);
        if (asset) {
          const props = JSON.parse(asset.props_json);
          props[`${subslot}MediaId`] = result.mediaId;
          themeRepo.upsertThemeAsset('draft', objectKey, asset.kind, asset.builtin, props, asset.sort_order);
        }
      }
    }

    auditRepo.log({
      action: 'media_upload',
      target: slot || result.mediaId,
      details: { mediaId: result.mediaId, originalName: req.file.originalname },
      ip: req.ip
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.delete('/theme/slots/:slot', (req, res) => {
  const slot = req.params.slot;
  const parts = slot.split('.');

  if (parts[0] === 'ui') {
    const field = parts[1];
    const asset = themeRepo.getThemeAsset('draft', 'ui');
    if (asset) {
      const props = JSON.parse(asset.props_json);
      delete props[`${field}MediaId`];
      themeRepo.upsertThemeAsset('draft', 'ui', 'ui', 1, props, 0);
    }
  } else {
    const objectKey = parts.slice(0, 2).join('.');
    const subslot = parts[2] || 'image';
    const asset = themeRepo.getThemeAsset('draft', objectKey);
    if (asset) {
      const props = JSON.parse(asset.props_json);
      delete props[`${subslot}MediaId`];
      themeRepo.upsertThemeAsset('draft', objectKey, asset.kind, asset.builtin, props, asset.sort_order);
    }
  }

  auditRepo.log({
    action: 'theme_reset_slot',
    target: slot,
    ip: req.ip
  });

  res.json({ ok: true, slot });
});

router.post('/theme/publish', (req, res) => {
  const nextVer = themeRepo.copyDraftToPublished();

  eventService.emit('theme.published', {
    data: { themeVersion: nextVer }
  });

  auditRepo.log({
    action: 'theme_publish',
    target: `v${nextVer}`,
    ip: req.ip
  });

  res.json({ ok: true, themeVersion: nextVer });
});

router.post('/theme/reset', (req, res) => {
  themeRepo.resetDraftToDefault();

  auditRepo.log({
    action: 'theme_reset_all',
    ip: req.ip
  });

  res.json({ ok: true });
});

router.get('/theme/export', (req, res) => {
  const theme = themeRepo.getTheme('draft');
  const zip = new AdmZip();

  zip.addFile('manifest.json', Buffer.from(JSON.stringify(theme, null, 2)));

  // Add uploaded media files referenced in the theme
  const mediaIds = new Set();
  for (const obj of theme.objects) {
    if (obj.imageMediaId) mediaIds.add(obj.imageMediaId);
    if (obj.halfLeftMediaId) mediaIds.add(obj.halfLeftMediaId);
    if (obj.halfRightMediaId) mediaIds.add(obj.halfRightMediaId);
  }
  if (theme.ui.logoMediaId) mediaIds.add(theme.ui.logoMediaId);
  if (theme.ui.backgroundMediaId) mediaIds.add(theme.ui.backgroundMediaId);

  const uploadDir = path.resolve(env.UPLOAD_DIR);
  for (const mid of mediaIds) {
    const m = mediaRepo.findById(mid);
    if (m) {
      const filePath = path.join(uploadDir, m.file_name);
      if (fs.existsSync(filePath)) {
        zip.addLocalFile(filePath, 'media');
      }
    }
  }

  const zipBuffer = zip.toBuffer();
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="blade-fruit-theme.zip"');
  res.send(zipBuffer);
});

router.post('/theme/import', upload.single('themeZip'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'No zip file provided',
        requestId: req.id || null
      }
    });
  }

  try {
    const zip = new AdmZip(req.file.buffer);
    const manifestEntry = zip.getEntry('manifest.json');
    if (!manifestEntry) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Zip archive is missing manifest.json',
          requestId: req.id || null
        }
      });
    }

    const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
    const uploadDir = path.resolve(env.UPLOAD_DIR);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Extract any media files
    const zipEntries = zip.getEntries();
    for (const entry of zipEntries) {
      if (entry.entryName.startsWith('media/') && !entry.isDirectory) {
        const fileName = path.basename(entry.entryName);
        fs.writeFileSync(path.join(uploadDir, fileName), entry.getData());
      }
    }

    // Update draft theme
    let order = 0;
    if (manifest.objects) {
      for (const obj of manifest.objects) {
        themeRepo.upsertThemeAsset('draft', obj.key, obj.kind, obj.builtin ? 1 : 0, {
          label: obj.label,
          radius: obj.radius,
          points: obj.points,
          spawnWeight: obj.spawnWeight,
          juiceColor: obj.juiceColor,
          enabled: obj.enabled !== false,
          imageMediaId: obj.imageMediaId || null,
          halfLeftMediaId: obj.halfLeftMediaId || null,
          halfRightMediaId: obj.halfRightMediaId || null
        }, order++);
      }
    }
    if (manifest.ui) {
      themeRepo.upsertThemeAsset('draft', 'ui', 'ui', 1, manifest.ui, 0);
    }
    if (manifest.audio) {
      themeRepo.upsertThemeAsset('draft', 'audio', 'audio', 1, manifest.audio, 0);
    }

    auditRepo.log({
      action: 'theme_import',
      ip: req.ip
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: `Failed to import theme zip: ${err.message}`,
        requestId: req.id || null
      }
    });
  }
});

export default router;
