/**
 * Floating Text Popup (Combos, Points, Critical).
 */

export class TextPopup {
  constructor() {
    this.reset();
  }

  reset() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.text = '';
    this.color = '#ffffff';
    this.strokeColor = '#000000';
    this.scale = 0.6;
    this.alpha = 1;
    this.ageMs = 0;
    this.durationMs = 600;
  }

  init(x, y, text, color = '#facc15', strokeColor = '#713f12', durationMs = 600) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.strokeColor = strokeColor;
    this.scale = 0.6;
    this.alpha = 1;
    this.ageMs = 0;
    this.durationMs = durationMs;
  }

  update(dtSec) {
    if (!this.active) return;
    this.ageMs += dtSec * 1000;
    if (this.ageMs >= this.durationMs) {
      this.active = false;
      return;
    }

    const progress = this.ageMs / this.durationMs;
    // Scale curve: 0.6 -> 1.25 -> 1.0
    if (progress < 0.3) {
      this.scale = 0.6 + (progress / 0.3) * 0.65;
    } else {
      this.scale = 1.25 - ((progress - 0.3) / 0.7) * 0.25;
    }

    this.y -= 40 * dtSec; // Float upward slightly
    this.alpha = Math.max(0, 1 - Math.pow(progress, 2.5));
  }

  render(ctx) {
    if (!this.active || this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);

    ctx.font = '900 38px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.lineWidth = 6;
    ctx.strokeStyle = this.strokeColor;
    ctx.strokeText(this.text, 0, 0);

    ctx.fillStyle = this.color;
    ctx.fillText(this.text, 0, 0);

    ctx.restore();
  }
}
