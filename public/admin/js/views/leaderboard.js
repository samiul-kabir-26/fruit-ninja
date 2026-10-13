/**
 * Admin Leaderboard Moderation View.
 */

import { adminApi } from '../api.js';

export async function renderLeaderboard(container) {
  let currentMode = 'classic';
  let currentPeriod = 'all';

  container.innerHTML = `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex flex-wrap justify-between items-center gap-4 bg-slate-900 border border-white/10 p-5 rounded-2xl">
        <div>
          <h1 class="text-xl font-black text-white">Leaderboard Moderation</h1>
          <p class="text-xs text-slate-400">Inspect rankings, remove cheated scores with audit log, and reset period watermarks</p>
        </div>

        <button id="btn-reset-board" class="px-4 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-xs font-bold border border-rose-800/40 cursor-pointer active:scale-95 transition">
          ⚠️ Reset Current Period
        </button>
      </div>

      <!-- Tabs -->
      <div class="bg-slate-900 border border-white/10 p-4 rounded-2xl flex flex-wrap gap-4 justify-between items-center text-xs">
        <!-- Mode Tabs -->
        <div class="flex rounded-lg bg-slate-800/80 p-1 border border-white/5">
          <button data-mode="classic" class="btn-tab-mode px-3 py-1.5 rounded-md font-bold text-white bg-rose-600 transition cursor-pointer">Classic</button>
          <button data-mode="arcade" class="btn-tab-mode px-3 py-1.5 rounded-md font-bold text-slate-300 hover:text-white transition cursor-pointer">Arcade</button>
          <button data-mode="zen" class="btn-tab-mode px-3 py-1.5 rounded-md font-bold text-slate-300 hover:text-white transition cursor-pointer">Zen</button>
        </div>

        <!-- Period Tabs -->
        <div class="flex rounded-lg bg-slate-800/80 p-1 border border-white/5">
          <button data-period="all" class="btn-tab-period px-3 py-1.5 rounded-md font-bold text-white bg-slate-700 transition cursor-pointer">All Time</button>
          <button data-period="weekly" class="btn-tab-period px-3 py-1.5 rounded-md font-bold text-slate-300 hover:text-white transition cursor-pointer">Weekly</button>
          <button data-period="daily" class="btn-tab-period px-3 py-1.5 rounded-md font-bold text-slate-300 hover:text-white transition cursor-pointer">Daily</button>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-sm">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="text-slate-400 border-b border-white/10 uppercase pb-2 bg-slate-950/40">
              <th class="py-3 px-4 w-16">Rank</th>
              <th class="py-3 px-4">Player</th>
              <th class="py-3 px-4">Score</th>
              <th class="py-3 px-4">Achieved At</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="board-admin-tbody" class="divide-y divide-white/5 text-slate-300">
            <tr><td colspan="6" class="text-center py-12 text-slate-500">Loading scores...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = container.querySelector('#board-admin-tbody');

  function updateTabButtons() {
    container.querySelectorAll('.btn-tab-mode').forEach(b => {
      b.className = b.dataset.mode === currentMode
        ? 'btn-tab-mode px-3 py-1.5 rounded-md font-bold text-white bg-rose-600 transition cursor-pointer'
        : 'btn-tab-mode px-3 py-1.5 rounded-md font-bold text-slate-300 hover:text-white transition cursor-pointer';
    });
    container.querySelectorAll('.btn-tab-period').forEach(b => {
      b.className = b.dataset.period === currentPeriod
        ? 'btn-tab-period px-3 py-1.5 rounded-md font-bold text-white bg-slate-700 transition cursor-pointer'
        : 'btn-tab-period px-3 py-1.5 rounded-md font-bold text-slate-300 hover:text-white transition cursor-pointer';
    });
  }

  async function loadScores() {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-12 text-slate-500">Loading scores...</td></tr>';
    try {
      const data = await adminApi.getLeaderboard({ mode: currentMode, period: currentPeriod, limit: 100 });
      if (!data.entries || data.entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-12 text-slate-500">No scores recorded for this period</td></tr>';
        return;
      }

      tbody.innerHTML = data.entries.map(e => `
        <tr class="hover:bg-white/5 transition ${e.removedAt ? 'opacity-40 line-through' : ''}">
          <td class="py-3 px-4 font-black text-amber-400">#${e.rank}</td>
          <td class="py-3 px-4 font-bold text-white">
            ${e.displayName}
            ${e.verified ? '<span class="ml-1 text-[10px] text-emerald-400">✓</span>' : ''}
          </td>
          <td class="py-3 px-4 font-black text-white italic text-sm">${e.score}</td>
          <td class="py-3 px-4 font-mono text-slate-400">${new Date(e.achievedAt).toLocaleString()}</td>
          <td class="py-3 px-4">
            ${e.removedAt ? '<span class="text-rose-400 font-bold">Removed</span>' : '<span class="text-emerald-400 font-bold">Active</span>'}
          </td>
          <td class="py-3 px-4 text-right">
            ${!e.removedAt ? `
              <button class="btn-remove-score px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/40 font-bold cursor-pointer transition" data-id="${e.id}">
                Remove
              </button>
            ` : '-'}
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-remove-score').forEach(b => {
        b.addEventListener('click', async () => {
          const reason = prompt('Reason for removing this score (required for audit log):', 'cheating/exploit');
          if (!reason) return;
          try {
            await adminApi.removeScore(b.dataset.id, reason);
            loadScores();
          } catch (err) {
            alert('Failed: ' + err.message);
          }
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-rose-400">Failed to load: ${err.message}</td></tr>`;
    }
  }

  container.querySelectorAll('.btn-tab-mode').forEach(b => {
    b.addEventListener('click', () => {
      currentMode = b.dataset.mode;
      updateTabButtons();
      loadScores();
    });
  });

  container.querySelectorAll('.btn-tab-period').forEach(b => {
    b.addEventListener('click', () => {
      currentPeriod = b.dataset.period;
      updateTabButtons();
      loadScores();
    });
  });

  container.querySelector('#btn-reset-board').addEventListener('click', async () => {
    const confirmText = prompt(`Type "${currentMode}" to confirm resetting the ${currentMode} ${currentPeriod} leaderboard:`);
    if (confirmText !== currentMode) return;
    try {
      await adminApi.resetLeaderboard(currentMode, currentPeriod);
      alert('Leaderboard reset watermark set.');
      loadScores();
    } catch (err) {
      alert('Reset failed: ' + err.message);
    }
  });

  loadScores();
}
