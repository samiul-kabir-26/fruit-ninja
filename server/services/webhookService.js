import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import { ulid } from 'ulid';
import { env } from '../config/env.js';
import * as webhooksRepo from '../repositories/webhooks.js';
import * as eventsRepo from '../repositories/events.js';
import { formatEnvelope } from './eventService.js';
import { decryptSecret, encryptSecret } from './tokenService.js';

const RETRY_INTERVALS_SEC = [10, 30, 120, 600, 1800, 3600, 10800, 21600, 43200, 86400];

export async function isUrlSafe(targetUrl) {
  if (env.WEBHOOK_ALLOW_PRIVATE || env.NODE_ENV === 'development') {
    return true;
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') {
    return false;
  }

  const hostname = parsed.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return false;
  }

  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const addr of addresses) {
      const ip = addr.address;
      // Check private IPv4 ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16
      if (
        /^10\./.test(ip) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
        /^192\.168\./.test(ip) ||
        /^127\./.test(ip) ||
        /^169\.254\./.test(ip) ||
        /^fc00:/.test(ip) ||
        /^fe80:/.test(ip) ||
        ip === '::1'
      ) {
        return false;
      }
    }
  } catch {
    return false;
  }

  return true;
}

export function signPayload(rawBody, secret, prevSecret = null) {
  const t = Math.floor(Date.now() / 1000);
  const sig1 = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  let header = `t=${t},v1=${sig1}`;

  if (prevSecret) {
    const sig2 = crypto.createHmac('sha256', prevSecret).update(`${t}.${rawBody}`).digest('hex');
    header += `,v1=${sig2}`;
  }

  return header;
}

export async function sendDelivery(delivery, endpoint) {
  const secret = decryptSecret(endpoint.secret_enc);
  let prevSecret = null;
  if (endpoint.prev_secret_enc && endpoint.prev_secret_expires_at) {
    if (new Date(endpoint.prev_secret_expires_at) > new Date()) {
      prevSecret = decryptSecret(endpoint.prev_secret_enc);
    }
  }

  // Fetch events for this delivery
  const rows = eventsRepo.findByCursor({
    cursorSeq: delivery.first_seq - 1,
    limit: delivery.event_count
  }).filter(r => r.seq <= delivery.last_seq);

  const events = rows.map(formatEnvelope);
  const payloadObj = {
    deliveryId: delivery.id,
    endpointId: endpoint.id,
    events
  };

  const rawBody = JSON.stringify(payloadObj);
  const signature = signPayload(rawBody, secret, prevSecret);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let statusCode = null;
  let responseSnippet = null;
  let errorMessage = null;
  let succeeded = false;

  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BladeFruit-Webhooks/1.0',
        'X-BF-Delivery-Id': delivery.id,
        'X-BF-Signature': signature
      },
      body: rawBody,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    statusCode = res.status;
    const text = await res.text();
    responseSnippet = text.slice(0, 1024);

    if (res.ok) {
      succeeded = true;
    } else {
      errorMessage = `HTTP ${statusCode}`;
    }
  } catch (err) {
    clearTimeout(timeoutId);
    errorMessage = err.name === 'AbortError' ? 'Timeout (10s)' : err.message;
  }

  const now = new Date().toISOString();
  const attempts = (delivery.attempts || 0) + 1;

  if (succeeded) {
    webhooksRepo.updateDelivery(delivery.id, {
      status: 'succeeded',
      attempts,
      last_status_code: statusCode,
      last_response_snippet: responseSnippet,
      last_error: null,
      completed_at: now
    });
    webhooksRepo.updateEndpoint(endpoint.id, {
      last_seq: delivery.last_seq,
      consecutive_failures: 0
    });
    return true;
  }

  // Failed
  const hasMoreRetries = attempts < RETRY_INTERVALS_SEC.length;
  let nextAttemptAt = null;

  if (hasMoreRetries) {
    const delaySec = RETRY_INTERVALS_SEC[attempts - 1];
    nextAttemptAt = new Date(Date.now() + delaySec * 1000).toISOString();
  }

  webhooksRepo.updateDelivery(delivery.id, {
    status: hasMoreRetries ? 'pending' : 'failed',
    attempts,
    next_attempt_at: nextAttemptAt,
    last_status_code: statusCode,
    last_error: errorMessage,
    last_response_snippet: responseSnippet,
    completed_at: hasMoreRetries ? null : now
  });

  if (!hasMoreRetries) {
    const consecutive = (endpoint.consecutive_failures || 0) + 1;
    const updateData = { consecutive_failures: consecutive };
    if (consecutive >= 3) {
      updateData.active = 0;
      updateData.disabled_reason = 'Disabled after 3 consecutive failed deliveries';
    }
    webhooksRepo.updateEndpoint(endpoint.id, updateData);
  }

  return false;
}

/**
 * Single tick of the webhook dispatcher worker.
 */
export async function dispatchWebhooks() {
  const endpoints = webhooksRepo.listEndpoints().filter(e => e.active);

  for (const endpoint of endpoints) {
    // Check pending deliveries
    const pendingList = webhooksRepo.getDeliveries(endpoint.id, 10).filter(d => d.status === 'pending');
    if (pendingList.length > 0) {
      const delivery = pendingList[pendingList.length - 1]; // oldest pending
      const now = new Date();
      if (!delivery.next_attempt_at || new Date(delivery.next_attempt_at) <= now) {
        await sendDelivery(delivery, endpoint);
      }
      // Wait for pending delivery to resolve before sending new events
      continue;
    }

    // No pending delivery: check for new events
    let subscribedTypes = [];
    try {
      subscribedTypes = JSON.parse(endpoint.event_types_json || '[]');
    } catch {
      subscribedTypes = [];
    }

    const typesFilter = subscribedTypes.includes('*') ? null : subscribedTypes;
    const newEvents = eventsRepo.findByCursor({
      cursorSeq: endpoint.last_seq,
      limit: 50,
      types: typesFilter
    });

    if (newEvents.length > 0) {
      const firstSeq = newEvents[0].seq;
      const lastSeq = newEvents[newEvents.length - 1].seq;
      const deliveryId = ulid();

      webhooksRepo.createDelivery({
        id: deliveryId,
        endpointId: endpoint.id,
        firstSeq,
        lastSeq,
        eventCount: newEvents.length,
        status: 'pending',
        nextAttemptAt: null
      });

      const delivery = webhooksRepo.getDelivery(deliveryId);
      await sendDelivery(delivery, endpoint);
    }
  }
}

let workerInterval = null;

export function startWebhookWorker() {
  if (workerInterval) return;
  workerInterval = setInterval(() => {
    dispatchWebhooks().catch(() => {});
  }, 1000);
}

export function stopWebhookWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}
