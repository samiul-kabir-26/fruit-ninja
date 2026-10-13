/**
 * Juice and Spark Particles.
 */

export class Particle {
  constructor() {
    this.reset();
  }

  reset() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.color = '#ffffff';
    this.radius = 4;
    this.alpha = 1;
    this.decay = 0.02;
    this.gravity = 800;
  }

  init(x, y, vx, vy, color, radius = 4, decay = 0.025) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.radius = radius;
    this.alpha = 1;
    this.decay = decay;
  }

  update(dtSec) {
    if (!this.active) return;
    this.x += this.vx * dtSec;
    this.y += this.vy * dtSec;
    this.vy += this.gravity * dtSec;
    this.alpha -= this.decay;
    if (this.alpha <= 0) {
      this.active = false;
    }
  }

  render(ctx) {
    if (!this.active || this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
