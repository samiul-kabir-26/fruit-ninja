/**
 * Multi-touch Pointer Events & Coordinate Mapping.
 */

import { BladeTrail } from './trail.js';

export class InputManager {
  constructor(canvas, logicalWidth = 1920, logicalHeight = 1080, onSwipeSegment = null) {
    this.canvas = canvas;
    this.logicalWidth = logicalWidth;
    this.logicalHeight = logicalHeight;
    this.onSwipeSegment = onSwipeSegment;

    this.trails = new Map(); // pointerId -> BladeTrail
    this.swipeIds = new Map(); // pointerId -> number
    this.nextSwipeId = 1;
    this.maxPointers = 2;

    this.initListeners();
  }

  getTrail(pointerId) {
    if (!this.trails.has(pointerId)) {
      if (this.trails.size >= this.maxPointers) return null;
      this.trails.set(pointerId, new BladeTrail());
      this.swipeIds.set(pointerId, this.nextSwipeId++);
    }
    return this.trails.get(pointerId);
  }

  toLogicalCoords(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.logicalWidth / rect.width;
    const scaleY = this.logicalHeight / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  initListeners() {
    this.canvas.addEventListener('pointerdown', (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      const trail = this.getTrail(e.pointerId);
      if (!trail) return;
      this.swipeIds.set(e.pointerId, this.nextSwipeId++);
      const coords = this.toLogicalCoords(e.clientX, e.clientY);
      trail.clear();
      trail.addPoint(coords.x, coords.y, performance.now());
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const trail = this.getTrail(e.pointerId);
      if (!trail) return;

      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
      const now = performance.now();
      const swipeId = this.swipeIds.get(e.pointerId) || 1;

      for (const ev of events) {
        const coords = this.toLogicalCoords(ev.clientX, ev.clientY);
        trail.addPoint(coords.x, coords.y, now);
      }

      if (this.onSwipeSegment) {
        const cuttingSegments = trail.getCuttingSegments();
        for (const seg of cuttingSegments) {
          this.onSwipeSegment(seg, swipeId);
        }
      }
    });

    const endPointer = (e) => {
      const trail = this.trails.get(e.pointerId);
      if (trail) {
        trail.clear();
        this.trails.delete(e.pointerId);
        this.swipeIds.delete(e.pointerId);
      }
    };

    this.canvas.addEventListener('pointerup', endPointer);
    this.canvas.addEventListener('pointercancel', endPointer);
  }

  update(now = performance.now()) {
    for (const trail of this.trails.values()) {
      trail.prune(now);
    }
  }

  render(ctx) {
    for (const trail of this.trails.values()) {
      trail.render(ctx);
    }
  }
}
