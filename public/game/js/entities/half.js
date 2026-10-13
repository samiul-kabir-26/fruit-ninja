/**
 * Flying Fruit Halves Entity.
 */

export class FruitHalf {
  constructor(fruit, side, cutAngleRad) {
    this.active = true;
    this.key = fruit.key;
    this.radius = fruit.radius;
    this.side = side; // 'left' | 'right'

    this.x = fruit.x;
    this.y = fruit.y;

    // Perpendicular impulse
    const perpAngle = cutAngleRad + (side === 'left' ? -Math.PI / 2 : Math.PI / 2);
    const impulse = 220;

    this.vx = fruit.vx + Math.cos(perpAngle) * impulse;
    this.vy = fruit.vy + Math.sin(perpAngle) * impulse;

    this.rotation = fruit.rotation;
    this.rotationSpeed = (side === 'left' ? -1 : 1) * 6.0;
  }

  update(dtSec, gravity = 1400) {
    if (!this.active) return;
    this.x += this.vx * dtSec;
    this.y += this.vy * dtSec;
    this.vy += gravity * dtSec;
    this.rotation += this.rotationSpeed * dtSec;
  }

  isOffscreen(logicalHeight = 1080) {
    return this.y > logicalHeight + this.radius && this.vy > 0;
  }

  render(ctx, assets) {
    if (!this.active) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    const halves = assets.getHalves(this.key);
    const img = halves ? halves[this.side] : null;

    if (img) {
      ctx.drawImage(img, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
    } else {
      // Fallback clipped hemisphere
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      if (this.side === 'left') {
        ctx.arc(0, 0, this.radius, Math.PI * 0.5, Math.PI * 1.5);
      } else {
        ctx.arc(0, 0, this.radius, -Math.PI * 0.5, Math.PI * 0.5);
      }
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
    }

    ctx.restore();
  }
}
