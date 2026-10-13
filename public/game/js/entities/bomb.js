/**
 * Bomb Hazard Entity.
 */

export class Bomb {
  constructor(def) {
    this.active = true;
    this.objectId = def.objectId;
    this.key = 'bomb';
    this.kind = 'bomb';
    this.radius = def.radius || 40;

    this.x = def.x0;
    this.y = def.y0;
    this.vx = def.vx;
    this.vy = def.vy;
    this.rotation = 0;
    this.rotationSpeed = def.angularVelocity || (Math.random() * 2 - 1);

    this.wasOnscreen = false;
    this.sliced = false;
    this.fuseSparkTimer = 0;
  }

  update(dtSec, gravity = 1400, onSpark = null) {
    if (!this.active) return;
    this.x += this.vx * dtSec;
    this.y += this.vy * dtSec;
    this.vy += gravity * dtSec;
    this.rotation += this.rotationSpeed * dtSec;

    if (this.y - this.radius < 1080) {
      this.wasOnscreen = true;
    }

    // Emit tiny fuse sparks periodically
    this.fuseSparkTimer += dtSec;
    if (this.fuseSparkTimer > 0.05 && onSpark) {
      this.fuseSparkTimer = 0;
      const sparkX = this.x + Math.sin(this.rotation) * (this.radius * 0.8);
      const sparkY = this.y - Math.cos(this.rotation) * (this.radius * 0.8);
      onSpark(sparkX, sparkY);
    }
  }

  isOffscreen(logicalHeight = 1080) {
    return this.y > logicalHeight + this.radius && this.vy > 0;
  }

  render(ctx, assets) {
    if (!this.active) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    const img = assets.getImage('bomb');
    if (img) {
      ctx.drawImage(img, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.restore();
  }
}
