/**
 * Segment-Circle Collision and Speed Detection.
 * Pure ESM module.
 */

/**
 * Test if a line segment intersects a circle.
 * @param {number} x1 Segment start X
 * @param {number} y1 Segment start Y
 * @param {number} x2 Segment end X
 * @param {number} y2 Segment end Y
 * @param {number} cx Circle center X
 * @param {number} cy Circle center Y
 * @param {number} r  Circle radius
 * @returns {boolean}
 */
export function checkSegmentCircleIntersection(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;

  if (l2 === 0) {
    const distSq = (cx - x1) * (cx - x1) + (cy - y1) * (cy - y1);
    return distSq <= r * r;
  }

  // Projection parameter t
  let t = ((cx - x1) * dx + (cy - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));

  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  const distSq = (cx - closestX) * (cx - closestX) + (cy - closestY) * (cy - closestY);
  return distSq <= r * r;
}

/**
 * Calculate cutting speed in logical pixels per second.
 * @param {number} x1
 * @param {number} y1
 * @param {number} t1 Timestamp in ms
 * @param {number} x2
 * @param {number} y2
 * @param {number} t2 Timestamp in ms
 * @returns {number} Speed in px/s
 */
export function calculateSegmentSpeed(x1, y1, t1, x2, y2, t2) {
  const dt = (t2 - t1) / 1000;
  if (dt <= 0) return 0;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  return dist / dt;
}

/**
 * Calculate the slice angle in radians.
 */
export function calculateSliceAngle(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}
