/**
 * Blade Trail Rendering and Segment History.
 */

export class BladeTrail {
  constructor(options = {}) {
    this.maxPoints = options.trailLength || 12;
    this.maxAgeMs = 120;
    this.points = []; // { x, y, time }
    this.bladeColor = options.bladeColor || '#ffffff';
    this.bladeGlow = options.bladeGlow || '#7dd3fc';
    this.minBladeSpeed = options.minBladeSpeed || 900;
    this.enableGlow = true;
  }

  setTheme(uiTheme = {}) {
    if (uiTheme.bladeColor) this.bladeColor = uiTheme.bladeColor;
    if (uiTheme.bladeGlow) this.bladeGlow = uiTheme.bladeGlow;
  }

  addPoint(x, y, time = performance.now()) {
    this.points.push({ x, y, time });
    this.prune(time);
  }

  prune(now = performance.now()) {
    while (this.points.length > 0) {
      const age = now - this.points[0].time;
      if (age > this.maxAgeMs || this.points.length > this.maxPoints) {
        this.points.shift();
      } else {
        break;
      }
    }
  }

  clear() {
    this.points = [];
  }

  getCuttingSegments(minSpeed = this.minBladeSpeed) {
    const segments = [];
    if (this.points.length < 2) return segments;

    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      const dt = (p2.time - p1.time) / 1000;
      if (dt <= 0) continue;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const speed = dist / dt;
      if (speed >= minSpeed) {
        segments.push({
          x1: p1.x,
          y1: p1.y,
          t1: p1.time,
          x2: p2.x,
          y2: p2.y,
          t2: p2.time,
          speed
        });
      }
    }
    return segments;
  }

  render(ctx) {
    if (this.points.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const count = this.points.length;

    // 1. Glow pass (if enabled)
    if (this.enableGlow) {
      ctx.shadowColor = this.bladeGlow;
      ctx.shadowBlur = 16;
      ctx.strokeStyle = this.bladeGlow;

      for (let i = 0; i < count - 1; i++) {
        const p1 = this.points[i];
        const p2 = this.points[i + 1];
        const progress = (i + 1) / count;
        ctx.lineWidth = progress * 16;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    // 2. Bright core blade
    ctx.shadowBlur = 0;
    ctx.strokeStyle = this.bladeColor;

    for (let i = 0; i < count - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      const progress = (i + 1) / count;
      ctx.lineWidth = Math.max(1.5, progress * 8);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    ctx.restore();
  }
}
