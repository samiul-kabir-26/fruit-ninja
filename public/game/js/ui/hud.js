/**
 * Game HUD Overlay (Score, Strikes/Timer, Pause, Specials).
 */

export class GameHUD {
  constructor(containerEl, onPauseClick, onMuteClick) {
    this.container = containerEl;
    this.onPauseClick = onPauseClick;
    this.onMuteClick = onMuteClick;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div id="hud-root" class="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 select-none z-10 hidden">
        <!-- Top Row -->
        <div class="flex justify-between items-start w-full">
          <!-- Score Block -->
          <div class="flex flex-col drop-shadow-md">
            <div class="flex items-center gap-2">
              <span class="text-xs uppercase tracking-widest text-amber-300 font-bold">Score</span>
            </div>
            <div id="hud-score" class="text-5xl font-black text-white italic tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">0</div>
            <div id="hud-best" class="text-sm font-semibold text-slate-300 drop-shadow">Best: 0</div>
          </div>

          <!-- Center Specials Badges (Arcade) -->
          <div id="hud-specials" class="flex gap-2 items-center pointer-events-none"></div>

          <!-- Top-Right: Strikes / Timer + Controls -->
          <div class="flex items-center gap-4">
            <!-- Strikes (Classic) -->
            <div id="hud-strikes" class="flex gap-2 items-center hidden">
              <span id="strike-1" class="text-3xl font-black text-slate-500 drop-shadow">✕</span>
              <span id="strike-2" class="text-3xl font-black text-slate-500 drop-shadow">✕</span>
              <span id="strike-3" class="text-3xl font-black text-slate-500 drop-shadow">✕</span>
            </div>

            <!-- Timer (Arcade / Zen) -->
            <div id="hud-timer" class="text-4xl font-black text-amber-400 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] hidden">
              60
            </div>

            <!-- Buttons -->
            <div class="flex gap-2 pointer-events-auto">
              <button id="btn-hud-mute" class="w-10 h-10 rounded-full bg-slate-900/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/20 backdrop-blur transition active:scale-95 cursor-pointer" title="Toggle Mute (M)">
                🔊
              </button>
              <button id="btn-hud-pause" class="w-10 h-10 rounded-full bg-slate-900/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/20 backdrop-blur transition active:scale-95 cursor-pointer font-bold" title="Pause (Esc)">
                ⏸
              </button>
            </div>
          </div>
        </div>

        <!-- Bottom Safe Space -->
        <div></div>
      </div>

      <!-- White flash overlay for bomb explosions -->
      <div id="hud-flash" class="absolute inset-0 bg-white pointer-events-none opacity-0 z-30 transition-opacity duration-300"></div>
    `;

    this.rootEl = this.container.querySelector('#hud-root');
    this.scoreEl = this.container.querySelector('#hud-score');
    this.bestEl = this.container.querySelector('#hud-best');
    this.strikesEl = this.container.querySelector('#hud-strikes');
    this.timerEl = this.container.querySelector('#hud-timer');
    this.specialsEl = this.container.querySelector('#hud-specials');
    this.flashEl = this.container.querySelector('#hud-flash');
    this.muteBtn = this.container.querySelector('#btn-hud-mute');
    this.pauseBtn = this.container.querySelector('#btn-hud-pause');

    this.pauseBtn.addEventListener('click', () => this.onPauseClick && this.onPauseClick());
    this.muteBtn.addEventListener('click', () => this.onMuteClick && this.onMuteClick());
  }

  show() {
    this.rootEl.classList.remove('hidden');
  }

  hide() {
    this.rootEl.classList.add('hidden');
  }

  updateScore(score, bestScore = 0) {
    this.scoreEl.textContent = String(score);
    this.bestEl.textContent = `Best: ${bestScore}`;
  }

  setMode(mode) {
    if (mode === 'classic') {
      this.strikesEl.classList.remove('hidden');
      this.timerEl.classList.add('hidden');
    } else {
      this.strikesEl.classList.add('hidden');
      this.timerEl.classList.remove('hidden');
    }
  }

  updateStrikes(strikesRemaining) {
    // 3 lives: strikes = 3 - livesRemaining
    const strikesCount = Math.max(0, 3 - strikesRemaining);
    for (let i = 1; i <= 3; i++) {
      const el = this.container.querySelector(`#strike-${i}`);
      if (el) {
        if (i <= strikesCount) {
          el.className = 'text-3xl font-black text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)]';
        } else {
          el.className = 'text-3xl font-black text-slate-600/70 drop-shadow';
        }
      }
    }
  }

  updateTimer(secondsLeft) {
    this.timerEl.textContent = String(Math.max(0, Math.ceil(secondsLeft)));
    if (secondsLeft <= 5) {
      this.timerEl.className = 'text-4xl font-black text-rose-400 animate-pulse drop-shadow-[0_0_12px_rgba(244,63,94,0.9)]';
    } else {
      this.timerEl.className = 'text-4xl font-black text-amber-400 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]';
    }
  }

  updateMuteIcon(isMuted) {
    this.muteBtn.textContent = isMuted ? '🔇' : '🔊';
  }

  triggerFlash() {
    this.flashEl.classList.remove('opacity-0');
    this.flashEl.classList.add('opacity-80');
    setTimeout(() => {
      this.flashEl.classList.remove('opacity-80');
      this.flashEl.classList.add('opacity-0');
    }, 150);
  }

  updateSpecials(activeSpecials = {}) {
    this.specialsEl.innerHTML = '';
    for (const [type, timeLeftSec] of Object.entries(activeSpecials)) {
      if (timeLeftSec <= 0) continue;
      const badge = document.createElement('div');
      let colorClass = 'bg-sky-500/80 text-sky-100 border-sky-300';
      if (type === 'frenzy') colorClass = 'bg-rose-500/80 text-rose-100 border-rose-300';
      if (type === 'double') colorClass = 'bg-amber-500/80 text-amber-100 border-amber-300';

      badge.className = `px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border backdrop-blur shadow-lg flex items-center gap-1.5 ${colorClass}`;
      badge.innerHTML = `<span>${type}</span> <span class="opacity-80 text-[10px]">${Math.ceil(timeLeftSec)}s</span>`;
      this.specialsEl.appendChild(badge);
    }
  }
}
