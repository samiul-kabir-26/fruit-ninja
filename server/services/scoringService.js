import { recomputeScoreFromEvents } from '../shared/scoringRules.js';
import { createWaveSpawner } from '../shared/spawner.js';

export function validateAndScoreSession(session, rawEvents, clientPayload) {
  const rejectionReasons = [];
  const validation = {};

  const startedAtMs = new Date(session.started_at).getTime();
  const nowMs = Date.now();
  const wallElapsedMs = Math.max(0, nowMs - startedAtMs);

  let settings = {};
  try {
    settings = JSON.parse(session.settings_json || '{}');
  } catch {
    settings = {};
  }

  const mode = session.mode;
  const lastSeq = clientPayload.lastSeq ?? session.last_seq;
  const clientScore = clientPayload.clientScore ?? 0;
  const reason = clientPayload.reason ?? 'quit';
  const durationMs = clientPayload.stats?.durationMs ?? wallElapsedMs;

  // Filter events belonging to this session
  const events = rawEvents
    .filter(e => e.session_id === session.id)
    .sort((a, b) => (a.client_seq ?? 0) - (b.client_seq ?? 0));

  // 1. Contiguous sequence check
  const seqs = events.map(e => e.client_seq).filter(s => s !== null && s !== undefined);
  let isContiguous = true;
  for (let i = 0; i < seqs.length; i++) {
    if (seqs[i] !== i + 1) {
      isContiguous = false;
      break;
    }
  }
  validation.seqContiguous = isContiguous;
  if (!isContiguous && seqs.length > 0 && seqs[seqs.length - 1] !== lastSeq) {
    rejectionReasons.push('Event sequence has missing gaps');
  }

  // 2. Monotonic time and skew check
  let isMonotonicTime = true;
  let maxSkewExceeded = false;
  let prevT = -1;

  for (const ev of events) {
    let evData = {};
    try {
      evData = JSON.parse(ev.data_json);
    } catch {
      evData = {};
    }
    const t = evData.t ?? 0;
    if (t < prevT) {
      isMonotonicTime = false;
    }
    if (t > wallElapsedMs + 2000) {
      maxSkewExceeded = true;
    }
    prevT = t;
  }
  validation.monotonicTime = isMonotonicTime;
  validation.maxSkewExceeded = maxSkewExceeded;
  if (!isMonotonicTime) {
    rejectionReasons.push('Event timestamps are non-monotonic');
  }
  if (maxSkewExceeded) {
    rejectionReasons.push('Event timestamp exceeded session duration skew');
  }

  // 3. Duration check
  let durationValid = true;
  if (mode === 'arcade') {
    const configDurSec = settings.modes?.arcade?.durationSec ?? 60;
    const diff = Math.abs(durationMs / 1000 - configDurSec);
    if (diff > 5) {
      durationValid = false;
    }
  } else if (mode === 'zen') {
    const configDurSec = settings.modes?.zen?.durationSec ?? 90;
    const diff = Math.abs(durationMs / 1000 - configDurSec);
    if (diff > 5) {
      durationValid = false;
    }
  } else if (mode === 'classic') {
    if (durationMs < 1500 && reason !== 'bomb') {
      durationValid = false;
    }
  }
  validation.durationValid = durationValid;
  if (!durationValid) {
    rejectionReasons.push(`Session duration (${Math.round(durationMs / 1000)}s) invalid for mode ${mode}`);
  }

  // 4. Slices per second rate check (<= 15 sustained over any 2s window)
  const sliceTimestamps = [];
  for (const ev of events) {
    if (ev.type === 'fruit.sliced') {
      let evData = {};
      try {
        evData = JSON.parse(ev.data_json);
      } catch {
        evData = {};
      }
      sliceTimestamps.push(evData.t ?? 0);
    }
  }
  sliceTimestamps.sort((a, b) => a - b);

  let sliceRateExceeded = false;
  for (let i = 0; i < sliceTimestamps.length; i++) {
    const windowStart = sliceTimestamps[i];
    let countInWindow = 0;
    for (let j = i; j < sliceTimestamps.length; j++) {
      if (sliceTimestamps[j] - windowStart <= 2000) {
        countInWindow++;
      } else {
        break;
      }
    }
    if (countInWindow > 30) { // > 15/sec over 2s
      sliceRateExceeded = true;
      break;
    }
  }
  validation.sliceRateOk = !sliceRateExceeded;
  if (sliceRateExceeded) {
    rejectionReasons.push('Slice rate exceeded human limit (>15 slices/sec over 2s)');
  }

  // 5. Deterministic spawn sequence replay & verification
  const spawner = createWaveSpawner(session.seed, mode, settings);
  const maxSpawnTimeMs = Math.max(durationMs + 3000, 120000);
  const spawnedObjects = spawner.getObjectsUpTo(maxSpawnTimeMs);
  const spawnedMap = new Map();
  let theoreticalMaxPoints = 0;

  for (const obj of spawnedObjects) {
    spawnedMap.set(obj.objectId, obj);
    theoreticalMaxPoints += (obj.points || 1);
  }

  const slicedCountsPerObject = new Map();
  let invalidObjectEncountered = false;

  for (const ev of events) {
    if (ev.type === 'fruit.sliced') {
      let evData = {};
      try {
        evData = JSON.parse(ev.data_json);
      } catch {
        evData = {};
      }
      const objId = evData.objectId;
      const t = evData.t ?? 0;
      const count = (slicedCountsPerObject.get(objId) || 0) + 1;
      slicedCountsPerObject.set(objId, count);

      const spawned = spawnedMap.get(objId);
      if (!spawned) {
        // Unknown object
        invalidObjectEncountered = true;
      } else {
        if (evData.objectKey && evData.objectKey !== spawned.key) {
          invalidObjectEncountered = true;
        }
        // Timing check: sliced while on screen
        if (t < spawned.spawnTimeMs - 200 || t > spawned.spawnTimeMs + spawned.maxAirtimeMs + 500) {
          invalidObjectEncountered = true;
        }
      }
    }
  }

  // Double slice check (pomegranate up to 40)
  let multiSliceViolation = false;
  for (const [objId, count] of slicedCountsPerObject.entries()) {
    const spawned = spawnedMap.get(objId);
    if (spawned?.key === 'fruit.pomegranate') {
      if (count > 40) multiSliceViolation = true;
    } else {
      if (count > 1) multiSliceViolation = true;
    }
  }
  validation.deterministicSpawnsOk = !invalidObjectEncountered;
  validation.multiSliceOk = !multiSliceViolation;
  if (invalidObjectEncountered) {
    rejectionReasons.push('Sliced object ID was not spawned by server sequence or was sliced outside airtime');
  }
  if (multiSliceViolation) {
    rejectionReasons.push('An object was sliced multiple times in one round');
  }

  // 6. Combo validation: combo count matches fruit.sliced sharing that swipeId
  const swipeSliceCounts = new Map();
  for (const ev of events) {
    if (ev.type === 'fruit.sliced') {
      let evData = {};
      try {
        evData = JSON.parse(ev.data_json);
      } catch {
        evData = {};
      }
      if (evData.swipeId !== undefined) {
        swipeSliceCounts.set(evData.swipeId, (swipeSliceCounts.get(evData.swipeId) || 0) + 1);
      }
    }
  }

  let comboMismatch = false;
  for (const ev of events) {
    if (ev.type === 'combo.achieved') {
      let evData = {};
      try {
        evData = JSON.parse(ev.data_json);
      } catch {
        evData = {};
      }
      const count = evData.count ?? 0;
      const actualSlices = swipeSliceCounts.get(evData.swipeId) || 0;
      if (count > actualSlices) {
        comboMismatch = true;
      }
    }
  }
  validation.combosValid = !comboMismatch;
  if (comboMismatch) {
    rejectionReasons.push('Combo count exceeded actual fruit sliced for that swipe');
  }

  // 7. Parse events to data shapes and recompute score
  const parsedEvents = events.map(e => {
    let data = {};
    try {
      data = JSON.parse(e.data_json);
    } catch {
      data = {};
    }
    return {
      type: e.type,
      t: data.t ?? 0,
      data
    };
  });

  const scoringConfig = settings.scoring || {};
  const { finalScore, stats } = recomputeScoreFromEvents(parsedEvents, mode, scoringConfig);

  // 8. Theoretical max check (generous bound with combos)
  const theoreticalMax = theoreticalMaxPoints * 4 + 100;
  if (finalScore > theoreticalMax) {
    rejectionReasons.push('Score exceeds theoretical physics maximum for wave sequence');
  }

  // 9. Classic mode life consistency
  if (mode === 'classic') {
    let lives = settings.modes?.classic?.lives ?? 3;
    let bombHit = false;
    for (const ev of parsedEvents) {
      if (ev.type === 'life.lost') {
        lives--;
      } else if (ev.type === 'life.gained') {
        lives = Math.min(settings.modes?.classic?.lives ?? 3, lives + 1);
      } else if (ev.type === 'bomb.hit') {
        bombHit = true;
      }
    }
    if (reason === 'strikes' && lives > 0) {
      rejectionReasons.push('Session claimed ended by strikes but lives remained');
    }
    if (reason === 'bomb' && !bombHit) {
      rejectionReasons.push('Session claimed ended by bomb but no bomb was hit');
    }
  }

  const accepted = rejectionReasons.length === 0;

  return {
    accepted,
    rejectionReasons,
    finalScore,
    clientScore,
    stats,
    validation
  };
}
