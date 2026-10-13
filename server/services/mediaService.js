import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import * as mm from 'music-metadata';
import sharp from 'sharp';
import { env } from '../config/env.js';
import * as mediaRepo from '../repositories/media.js';

function ensureUploadDir() {
  const dir = path.resolve(env.UPLOAD_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function processUpload(fileBuffer, originalName = 'upload', slot = '') {
  if (!fileBuffer || fileBuffer.length === 0) {
    const err = new Error('Empty file upload');
    err.status = 400;
    err.code = 'VALIDATION_FAILED';
    throw err;
  }

  if (fileBuffer.length > env.MAX_UPLOAD_BYTES) {
    const err = new Error(`File exceeds maximum size of ${env.MAX_UPLOAD_BYTES} bytes`);
    err.status = 413;
    err.code = 'PAYLOAD_TOO_LARGE';
    throw err;
  }

  const detected = await fileTypeFromBuffer(fileBuffer);
  if (!detected) {
    const err = new Error('Unable to determine file type');
    err.status = 415;
    err.code = 'UNSUPPORTED_MEDIA_TYPE';
    throw err;
  }

  const mime = detected.mime;
  const isImage = ['image/png', 'image/jpeg', 'image/webp'].includes(mime);
  const isAudio = ['audio/mpeg', 'audio/ogg'].includes(mime);

  if (!isImage && !isAudio) {
    const err = new Error(`Unsupported file type: ${mime}. Allowed: PNG, JPEG, WebP, MP3, OGG`);
    err.status = 415;
    err.code = 'UNSUPPORTED_MEDIA_TYPE';
    throw err;
  }

  const uploadDir = ensureUploadDir();
  let processedBuffer;
  let finalMime = mime;
  let ext = detected.ext;
  let width = null;
  let height = null;
  let kind = 'image';

  if (isImage) {
    kind = 'image';
    finalMime = 'image/webp';
    ext = 'webp';

    const isBackground = slot.includes('background');
    const maxWidth = isBackground ? 2560 : 512;
    const maxHeight = isBackground ? 1440 : 512;

    const pipeline = sharp(fileBuffer)
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 90, alphaQuality: 100 });

    processedBuffer = await pipeline.toBuffer();
    const metadata = await sharp(processedBuffer).metadata();
    width = metadata.width;
    height = metadata.height;
  } else {
    kind = 'audio';
    processedBuffer = fileBuffer;
    try {
      const meta = await mm.parseBuffer(processedBuffer, mime);
      const durSec = meta.format.duration || 0;
      if (slot.includes('music') && durSec > 180) {
        const err = new Error('Music tracks cannot exceed 3 minutes');
        err.status = 400;
        err.code = 'VALIDATION_FAILED';
        throw err;
      }
      if (!slot.includes('music') && durSec > 10) {
        const err = new Error('SFX cannot exceed 10 seconds');
        err.status = 400;
        err.code = 'VALIDATION_FAILED';
        throw err;
      }
    } catch (e) {
      if (e.status) throw e;
      // non-fatal parse failure if audio is otherwise valid
    }
  }

  // Content-based ID: SHA256 first 32 chars
  const id = crypto.createHash('sha256').update(processedBuffer).digest('hex').slice(0, 32);
  const fileName = `${id}.${ext}`;
  const filePath = path.join(uploadDir, fileName);

  fs.writeFileSync(filePath, processedBuffer);

  mediaRepo.insert({
    id,
    kind,
    mime: finalMime,
    fileName,
    width,
    height,
    bytes: processedBuffer.length,
    originalName
  });

  return {
    mediaId: id,
    url: `/media/${fileName}`,
    width,
    height,
    bytes: processedBuffer.length,
    mime: finalMime
  };
}
