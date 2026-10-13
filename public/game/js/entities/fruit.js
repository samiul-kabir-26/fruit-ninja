/**
 * Whole Fruit Entity.
 */

export class Fruit {
  constructor(def) {
    this.active = true;
    this.objectId = def.objectId;
    this.key = def.key;
    this.kind = def.kind || 'fruit';
    this.label = def.label || def.key;
    this.radius = def.radius || 42;
    this.points = def.points ?? 1;
    this.juiceColor = def.juiceColor || '#ffffff';
    this.specialType = def.specialType;

    this.x = def.x0;
    this.y = def.y0;
    this.vx = def.vx;
    this.vy = def.vy;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = def.angularVelocity || (Math.random() * 4 - 2);

    this.sliced = false;
    this.wasOnscreen = false;
    this.missReported = false;
    this.sliceHits = 0; // for pomegranate
  }

  update(dtSec, gravity = 1400) {
    if (!this.active) return;
    this.x += this.vx * dtSec;
    this.y += this.vy * dtSec;
    this.vy += gravity * dtSec;
    this.rotation += this.rotationSpeed * dtSec;

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
    ctx.rotate(this.rotation);

    const img = assets.getImage(this.key);
    if (img) {
      ctx.drawImage(img, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
    } else {
      // Fallback procedural circle
      ctx.fillStyle = this.juiceColor;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
    }

    ctx.restore();
  }
}
