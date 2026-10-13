/**
 * Fixed Timestep Game Loop with Accumulator and Quality Downgrade.
 */

export class GameLoop {
  constructor({ updateFn, renderFn, onAutoQualityDowngrade = null, onPauseStateChange = null }) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this.onAutoQualityDowngrade = onAutoQualityDowngrade;
    this.onPauseStateChange = onPauseStateChange;

    this.timestep = 1000 / 120; // 120Hz fixed physics step = 8.33ms
    this.accumulator = 0;
    this.lastTime = 0;
    this.running = false;
    this.paused = false;
    this.rafId = null;

    // Performance profiling for auto quality
    this.frameTimes = [];
    this.isLowQuality = false;

    this.initVisibilityHandlers();
  }

  initVisibilityHandlers() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.pause();
      }
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick.bind(this));
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    if (this.onPauseStateChange) {
      this.onPauseStateChange(true);
    }
  }

  resume() {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
    if (this.onPauseStateChange) {
      this.onPauseStateChange(false);
    }
  }

  tick(currentTime) {
    if (!this.running) return;

    if (this.paused) {
      this.rafId = requestAnimationFrame(this.tick.bind(this));
      return;
    }

    let delta = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Cap frame delta to prevent spiral of death
    if (delta > 250) delta = 250;

    // Profile performance for auto quality downgrade
    this.frameTimes.push(delta);
    if (this.frameTimes.length > 120) { // ~2 seconds at 60fps
      this.frameTimes.shift();
      const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      if (avg > 20 && !this.isLowQuality) {
        this.isLowQuality = true;
        if (this.onAutoQualityDowngrade) {
          this.onAutoQualityDowngrade();
        }
      }
    }

    this.accumulator += delta;

    while (this.accumulator >= this.timestep) {
      this.updateFn(this.timestep);
      this.accumulator -= this.timestep;
    }

    const alpha = this.accumulator / this.timestep;
    this.renderFn(alpha);

    this.rafId = requestAnimationFrame(this.tick.bind(this));
  }
}
