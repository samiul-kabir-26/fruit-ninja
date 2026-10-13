/**
 * Background Juice Splatter Decal.
 */

export class JuiceSplat {
  constructor() {
    this.reset();
  }

  reset() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.color = '#ffffff';
    this.radius = 35;
    this.alpha = 0.65;
    this.lifeSec = 3.0;
    this.ageSec = 0;
    this.droplets = [];
  }

  init(x, y, color, baseRadius = 35) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = baseRadius;
    this.alpha = 0.65;
    this.lifeSec = 3.0;
    this.ageSec = 0;

    // Generate random radial splatter blobs
    this.droplets = [];
    const count = 5 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = (baseRadius * 0.4) + Math.random() * (baseRadius * 0.8);
      const r = (baseRadius * 0.15) + Math.random() * (baseRadius * 0.25);
      this.droplets.push({
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        r
      });
    }
  }

  update(dtSec) {
    if (!this.active) return;
    this.ageSec += dtSec;
    if (this.ageSec >= this.lifeSec) {
      this.active = false;
      return;
    }
    this.alpha = 0.65 * (1 - (this.ageSec / this.lifeSec));
  }

  render(ctx) {
    if (!this.active || this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;

    // Center blob
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Satellite droplets
    for (const d of this.droplets) {
      ctx.beginPath();
      ctx.arc(this.x + d.dx, this.y + d.dy, d.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
