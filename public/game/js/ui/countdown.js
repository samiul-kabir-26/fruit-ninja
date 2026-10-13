/**
 * 3-2-1 Countdown Overlay.
 */

export class Countdown {
  constructor(containerEl, onComplete) {
    this.container = containerEl;
    this.onComplete = onComplete;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div id="countdown-root" class="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-20 hidden">
        <div id="countdown-text" class="text-9xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-white to-amber-400 drop-shadow-[0_10px_25px_rgba(0,0,0,0.9)] transform transition-transform duration-300">
          3
        </div>
      </div>
    `;
    this.rootEl = this.container.querySelector('#countdown-root');
    this.textEl = this.container.querySelector('#countdown-text');
  }

  start(onComplete) {
    if (onComplete) this.onComplete = onComplete;
    this.rootEl.classList.remove('hidden');
    let count = 3;
    this.textEl.textContent = '3';

    const step = () => {
      this.textEl.style.transform = 'scale(1.4)';
      setTimeout(() => {
        this.textEl.style.transform = 'scale(1.0)';
      }, 100);

      setTimeout(() => {
        count--;
        if (count > 0) {
          this.textEl.textContent = String(count);
          step();
        } else if (count === 0) {
          this.textEl.textContent = 'GO!';
          this.textEl.style.transform = 'scale(1.6)';
          setTimeout(() => {
            this.rootEl.classList.add('hidden');
            if (this.onComplete) {
              const cb = this.onComplete;
              this.onComplete = null;
              cb();
            }
          }, 350);
        }
      }, 500);
    };

    step();
  }
}
