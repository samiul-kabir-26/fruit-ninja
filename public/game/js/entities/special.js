/**
 * Special Arcade Banana Entity.
 */

export class SpecialBanana {
  constructor(def) {
    this.active = true;
    this.objectId = def.objectId;
    this.key = def.key;
    this.kind = 'special';
    this.specialType = def.specialType || 'freeze';
    this.radius = def.radius || 44;
    this.points = 1;
    this.juiceColor = def.juiceColor || '#81d4fa';

    this.x = def.x0;
    this.y = def.y0;
    this.vx = def.vx;
    this.vy = def.vy;
    this.rotation = 0;
    this.rotationSpeed = def.angularVelocity || 2.5;

    this.wasOnscreen = false;
    this.sliced = false;
    this.pulse = 0;
  }

  update(dtSec, gravity = 1400) {
    if (!this.active) return;
    this.x += this.vx * dtSec;
    this.y += this.vy * dtSec;
    this.vy += gravity * dtSec;
    this.rotation += this.rotationSpeed * dtSec;
    this.pulse += dtSec * 5;

    if (this.y - this.radius < 1080) {
      this.wasOnscreen = true;
    }
  }

  isOffscreen(logicalHeight = 1080) {
    return this.y > logicalHeight + this.radius && this.vy > 0;
  }

  render(ctx, assets) {
    if (!this.active) return;
    ctx.save();
    ctx.translate(this.x, this.y);

    // Glowing aura
    const auraRadius = this.radius + Math.sin(this.pulse) * 6;
    ctx.shadowColor = this.juiceColor;
    ctx.shadowBlur = 20;

    ctx.rotate(this.rotation);

    const img = assets.getImage(this.key);
    if (img) {
      ctx.drawImage(img, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
    } else {
      ctx.fillStyle = this.juiceColor;
      ctx.beginPath();
      ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
