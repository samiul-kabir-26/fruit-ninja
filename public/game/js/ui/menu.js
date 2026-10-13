/**
 * Main Menu Overlay (Slice-to-select + Accessible buttons).
 */

export class MainMenu {
  constructor(containerEl, onSelectMode, onOpenLeaderboard, onToggleMute) {
    this.container = containerEl;
    this.onSelectMode = onSelectMode;
    this.onOpenLeaderboard = onOpenLeaderboard;
    this.onToggleMute = onToggleMute;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div id="menu-root" class="absolute inset-0 pointer-events-none flex flex-col justify-between items-center p-8 select-none z-20">
        <!-- Top Bar: Player profile & sound -->
        <div class="w-full flex justify-between items-center pointer-events-auto">
          <div id="menu-player-badge" class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 border border-white/10 backdrop-blur text-sm text-slate-200">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span id="menu-player-name" class="font-bold">Player</span>
            <span id="menu-verified-tag" class="text-xs text-amber-400 font-semibold hidden">Verified</span>
          </div>

          <button id="btn-menu-mute" class="w-10 h-10 rounded-full bg-slate-900/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/20 backdrop-blur cursor-pointer active:scale-95 transition">
            🔊
          </button>
        </div>

        <!-- Center: Logo -->
        <div class="flex flex-col items-center drop-shadow-2xl text-center pointer-events-none">
          <div class="relative">
            <h1 class="text-7xl md:text-8xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)]">
              BLADE FRUIT
            </h1>
            <div class="h-1.5 w-full bg-gradient-to-r from-transparent via-white to-transparent opacity-60 rounded -mt-2"></div>
          </div>
          <p class="text-sm uppercase tracking-widest text-slate-300 font-bold mt-3 drop-shadow">
            Swipe floating fruit or click buttons below
          </p>
        </div>

        <!-- Bottom: Mode selection buttons -->
        <div class="w-full max-w-xl flex flex-col items-center gap-4 pointer-events-auto">
          <div class="grid grid-cols-3 gap-3 w-full">
            <button id="btn-mode-classic" class="px-4 py-3.5 rounded-xl bg-gradient-to-b from-rose-500 to-red-700 hover:from-rose-400 hover:to-red-600 text-white font-black text-lg uppercase tracking-wide border border-rose-300/40 shadow-lg shadow-rose-950/50 cursor-pointer active:scale-95 transition flex flex-col items-center">
              <span>Classic</span>
              <span class="text-[10px] font-semibold tracking-normal text-rose-200">3 Strikes</span>
            </button>

            <button id="btn-mode-arcade" class="px-4 py-3.5 rounded-xl bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white font-black text-lg uppercase tracking-wide border border-amber-300/40 shadow-lg shadow-amber-950/50 cursor-pointer active:scale-95 transition flex flex-col items-center">
              <span>Arcade</span>
              <span class="text-[10px] font-semibold tracking-normal text-amber-200">60s Timer</span>
            </button>

            <button id="btn-mode-zen" class="px-4 py-3.5 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white font-black text-lg uppercase tracking-wide border border-emerald-300/40 shadow-lg shadow-emerald-950/50 cursor-pointer active:scale-95 transition flex flex-col items-center">
              <span>Zen</span>
              <span class="text-[10px] font-semibold tracking-normal text-emerald-200">90s Peace</span>
            </button>
          </div>

          <button id="btn-menu-board" class="px-6 py-2 rounded-lg bg-slate-900/70 hover:bg-slate-800 text-slate-200 hover:text-white text-sm font-bold border border-white/10 backdrop-blur cursor-pointer active:scale-95 transition flex items-center gap-2">
            🏆 <span>Leaderboard</span>
          </button>
        </div>
      </div>
    `;

    this.rootEl = this.container.querySelector('#menu-root');
    this.nameEl = this.container.querySelector('#menu-player-name');
    this.verifiedTagEl = this.container.querySelector('#menu-verified-tag');
    this.muteBtn = this.container.querySelector('#btn-menu-mute');

    this.container.querySelector('#btn-mode-classic').addEventListener('click', () => this.onSelectMode('classic'));
    this.container.querySelector('#btn-mode-arcade').addEventListener('click', () => this.onSelectMode('arcade'));
    this.container.querySelector('#btn-mode-zen').addEventListener('click', () => this.onSelectMode('zen'));
    this.container.querySelector('#btn-menu-board').addEventListener('click', () => this.onOpenLeaderboard());
    this.muteBtn.addEventListener('click', () => this.onToggleMute());
  }

  show() {
    this.rootEl.classList.remove('hidden');
  }

  hide() {
    this.rootEl.classList.add('hidden');
  }

  setPlayer(player) {
    if (!player) return;
    this.nameEl.textContent = player.displayName || 'Player';
    if (player.verified) {
      this.verifiedTagEl.classList.remove('hidden');
    } else {
      this.verifiedTagEl.classList.add('hidden');
    }
  }

  updateMuteIcon(isMuted) {
    this.muteBtn.textContent = isMuted ? '🔇' : '🔊';
  }
}
