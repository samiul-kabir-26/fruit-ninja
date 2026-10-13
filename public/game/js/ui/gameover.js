/**
 * Game Over Screen Overlay.
 */

export class GameOverScreen {
  constructor(containerEl, { onPlayAgain, onLeaderboard, onMenu }) {
    this.container = containerEl;
    this.onPlayAgain = onPlayAgain;
    this.onLeaderboard = onLeaderboard;
    this.onMenu = onMenu;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div id="gameover-root" class="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 select-none z-30 hidden animate-fade-in">
        <div class="flex flex-col items-center max-w-md w-full bg-slate-900/90 border border-white/10 p-8 rounded-3xl shadow-2xl gap-6 text-center">
          <!-- Title -->
          <div class="flex flex-col items-center">
            <span class="text-xs uppercase tracking-widest text-rose-400 font-extrabold">Game Over</span>
            <div id="gameover-reason" class="text-3xl font-black italic text-white drop-shadow">Bomb Exploded!</div>
          </div>

          <!-- Main Score -->
          <div class="flex flex-col items-center bg-slate-950/60 w-full py-4 rounded-2xl border border-white/5">
            <span class="text-xs uppercase tracking-widest text-slate-400 font-bold">Final Score</span>
            <span id="gameover-score" class="text-6xl font-black italic text-amber-400 drop-shadow-[0_2px_12px_rgba(251,191,36,0.6)]">0</span>
            <div id="gameover-best" class="text-xs font-semibold text-slate-400 mt-1">Personal Best: 0</div>
          </div>

          <!-- Stats Grid -->
          <div class="grid grid-cols-3 gap-2 w-full text-center">
            <div class="bg-slate-800/60 p-2.5 rounded-xl border border-white/5">
              <div class="text-[10px] uppercase font-bold text-slate-400">Sliced</div>
              <div id="stat-sliced" class="text-xl font-black text-white">0</div>
            </div>
            <div class="bg-slate-800/60 p-2.5 rounded-xl border border-white/5">
              <div class="text-[10px] uppercase font-bold text-slate-400">Best Combo</div>
              <div id="stat-combo" class="text-xl font-black text-white">0</div>
            </div>
            <div class="bg-slate-800/60 p-2.5 rounded-xl border border-white/5">
              <div class="text-[10px] uppercase font-bold text-slate-400">Weekly Rank</div>
              <div id="stat-rank" class="text-xl font-black text-amber-300">-</div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-col gap-2.5 w-full mt-2">
            <button id="btn-over-retry" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-lg shadow-lg cursor-pointer active:scale-95 transition">
              Play Again
            </button>
            <div class="flex gap-2">
              <button id="btn-over-board" class="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-white/10 cursor-pointer active:scale-95 transition">
                🏆 Leaderboard
              </button>
              <button id="btn-over-menu" class="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-white/10 cursor-pointer active:scale-95 transition">
                Main Menu
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.rootEl = this.container.querySelector('#gameover-root');
    this.reasonEl = this.container.querySelector('#gameover-reason');
    this.scoreEl = this.container.querySelector('#gameover-score');
    this.bestEl = this.container.querySelector('#gameover-best');
    this.statSlicedEl = this.container.querySelector('#stat-sliced');
    this.statComboEl = this.container.querySelector('#stat-combo');
    this.statRankEl = this.container.querySelector('#stat-rank');

    this.container.querySelector('#btn-over-retry').addEventListener('click', () => this.onPlayAgain && this.onPlayAgain());
    this.container.querySelector('#btn-over-board').addEventListener('click', () => this.onLeaderboard && this.onLeaderboard());
    this.container.querySelector('#btn-over-menu').addEventListener('click', () => this.onMenu && this.onMenu());
  }

  show(resultData) {
    const { finalScore = 0, personalBest = 0, reason = '', stats = {}, rank = {} } = resultData;

    let reasonText = 'Round Completed!';
    if (reason === 'bomb') reasonText = '💥 Bomb Exploded!';
    if (reason === 'strikes') reasonText = '✕ 3 Strikes!';
    if (reason === 'timer') reasonText = '⏰ Time Expired!';
    if (reason === 'quit') reasonText = 'Round Ended';

    this.reasonEl.textContent = reasonText;
    this.scoreEl.textContent = String(finalScore);
    this.bestEl.textContent = `Personal Best: ${personalBest}`;
    this.statSlicedEl.textContent = String(stats.sliced || 0);
    this.statComboEl.textContent = String(stats.bestCombo || 0);
    this.statRankEl.textContent = rank.weekly ? `#${rank.weekly}` : (rank.all ? `#${rank.all}` : '-');

    this.rootEl.classList.remove('hidden');
  }

  hide() {
    this.rootEl.classList.add('hidden');
  }
}
