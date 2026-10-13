/**
 * In-Game Leaderboard Modal.
 */

import { api } from '../api.js';

export class LeaderboardModal {
  constructor(containerEl, onClose) {
    this.container = containerEl;
    this.onClose = onClose;

    this.currentMode = 'classic';
    this.currentPeriod = 'all';
    this.verifiedOnly = false;

    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div id="board-root" class="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 select-none z-40 hidden">
        <div class="flex flex-col max-w-xl w-full h-[85vh] bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
          <!-- Header -->
          <div class="p-6 pb-4 border-b border-white/10 flex justify-between items-center bg-slate-950/40">
            <div>
              <h2 class="text-2xl font-black italic text-white flex items-center gap-2">
                🏆 <span>LEADERBOARD</span>
              </h2>
              <p class="text-xs text-slate-400">Best scores across all players</p>
            </div>
            <button id="btn-board-close" class="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-sm cursor-pointer active:scale-95 transition">
              ✕
            </button>
          </div>

          <!-- Controls: Mode tabs, Period tabs, Verified toggle -->
          <div class="px-6 py-3 border-b border-white/10 bg-slate-950/20 flex flex-wrap gap-3 justify-between items-center text-xs">
            <!-- Mode Tabs -->
            <div class="flex rounded-lg bg-slate-800/80 p-1 border border-white/5">
              <button data-mode="classic" class="btn-tab-mode px-3 py-1 rounded-md font-bold text-white bg-rose-600 transition cursor-pointer">Classic</button>
              <button data-mode="arcade" class="btn-tab-mode px-3 py-1 rounded-md font-bold text-slate-300 hover:text-white transition cursor-pointer">Arcade</button>
              <button data-mode="zen" class="btn-tab-mode px-3 py-1 rounded-md font-bold text-slate-300 hover:text-white transition cursor-pointer">Zen</button>
            </div>

            <!-- Period Tabs -->
            <div class="flex rounded-lg bg-slate-800/80 p-1 border border-white/5">
              <button data-period="all" class="btn-tab-period px-2.5 py-1 rounded-md font-bold text-white bg-slate-700 transition cursor-pointer">All Time</button>
              <button data-period="weekly" class="btn-tab-period px-2.5 py-1 rounded-md font-bold text-slate-300 hover:text-white transition cursor-pointer">Weekly</button>
              <button data-period="daily" class="btn-tab-period px-2.5 py-1 rounded-md font-bold text-slate-300 hover:text-white transition cursor-pointer">Daily</button>
            </div>

            <!-- Verified Only Toggle -->
            <label class="flex items-center gap-2 cursor-pointer text-slate-300 font-semibold select-none">
              <input type="checkbox" id="chk-verified-only" class="rounded accent-amber-500 cursor-pointer">
              <span>Verified only</span>
            </label>
          </div>

          <!-- Entries Table -->
          <div class="flex-1 overflow-y-auto p-4">
            <table class="w-full text-left text-sm border-collapse">
              <thead>
                <tr class="text-xs uppercase text-slate-400 border-b border-white/10 pb-2">
                  <th class="py-2 pl-3 w-14">Rank</th>
                  <th class="py-2">Player</th>
                  <th class="py-2 text-right pr-4">Score</th>
                </tr>
              </thead>
              <tbody id="board-table-body" class="divide-y divide-white/5">
                <tr><td colspan="3" class="text-center py-8 text-slate-400">Loading leaderboard...</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Bottom: Current Player Rank Card -->
          <div id="board-me-card" class="p-3.5 bg-slate-950/80 border-t border-white/10 flex justify-between items-center text-xs px-6">
            <span class="text-slate-400">Your Rank:</span>
            <span id="board-me-rank" class="font-bold text-amber-400">Not ranked</span>
          </div>
        </div>
      </div>
    `;

    this.rootEl = this.container.querySelector('#board-root');
    this.tableBodyEl = this.container.querySelector('#board-table-body');
    this.meRankEl = this.container.querySelector('#board-me-rank');
    this.verifiedCheckbox = this.container.querySelector('#chk-verified-only');

    this.container.querySelector('#btn-board-close').addEventListener('click', () => {
      this.hide();
      if (this.onClose) this.onClose();
    });

    // Mode tab handlers
    this.container.querySelectorAll('.btn-tab-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentMode = btn.dataset.mode;
        this.updateTabStyles();
        this.loadData();
      });
    });

    // Period tab handlers
    this.container.querySelectorAll('.btn-tab-period').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentPeriod = btn.dataset.period;
        this.updateTabStyles();
        this.loadData();
      });
    });

    this.verifiedCheckbox.addEventListener('change', (e) => {
      this.verifiedOnly = e.target.checked;
      this.loadData();
    });
  }

  updateTabStyles() {
    this.container.querySelectorAll('.btn-tab-mode').forEach(btn => {
      if (btn.dataset.mode === this.currentMode) {
        btn.className = 'btn-tab-mode px-3 py-1 rounded-md font-bold text-white bg-rose-600 transition cursor-pointer';
      } else {
        btn.className = 'btn-tab-mode px-3 py-1 rounded-md font-bold text-slate-300 hover:text-white transition cursor-pointer';
      }
    });

    this.container.querySelectorAll('.btn-tab-period').forEach(btn => {
      if (btn.dataset.period === this.currentPeriod) {
        btn.className = 'btn-tab-period px-2.5 py-1 rounded-md font-bold text-white bg-slate-700 transition cursor-pointer';
      } else {
        btn.className = 'btn-tab-period px-2.5 py-1 rounded-md font-bold text-slate-300 hover:text-white transition cursor-pointer';
      }
    });
  }

  async loadData() {
    this.tableBodyEl.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-slate-400">Loading leaderboard...</td></tr>';
    try {
      const data = await api.fetchLeaderboard(this.currentMode, this.currentPeriod, this.verifiedOnly);
      if (!data.entries || data.entries.length === 0) {
        this.tableBodyEl.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-slate-500">No scores yet in this period!</td></tr>';
        this.meRankEl.textContent = 'Not ranked';
        return;
      }

      const rowsHtml = data.entries.map(e => {
        const isMe = api.player && e.playerId === api.player.id;
        const rowClass = isMe ? 'bg-amber-500/20 font-bold border-l-4 border-amber-400' : 'hover:bg-white/5';
        let rankBadge = `#${e.rank}`;
        if (e.rank === 1) rankBadge = '🥇';
        if (e.rank === 2) rankBadge = '🥈';
        if (e.rank === 3) rankBadge = '🥉';

        return `
          <tr class="${rowClass} transition">
            <td class="py-2.5 pl-3 font-black text-amber-400">${rankBadge}</td>
            <td class="py-2.5 flex items-center gap-2">
              <span class="text-slate-200">${e.displayName}</span>
              ${e.verified ? '<span class="text-[10px] bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold">Verified</span>' : ''}
            </td>
            <td class="py-2.5 text-right pr-4 font-black text-white italic text-base">${e.score}</td>
          </tr>
        `;
      }).join('');

      this.tableBodyEl.innerHTML = rowsHtml;

      if (data.me) {
        this.meRankEl.textContent = `Rank #${data.me.rank} (${data.me.score} pts)`;
      } else {
        this.meRankEl.textContent = 'Not ranked';
      }
    } catch {
      this.tableBodyEl.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-rose-400">Failed to load leaderboard.</td></tr>';
    }
  }

  show(initialMode = 'classic') {
    this.currentMode = initialMode;
    this.updateTabStyles();
    this.rootEl.classList.remove('hidden');
    this.loadData();
  }

  hide() {
    this.rootEl.classList.add('hidden');
  }
}
