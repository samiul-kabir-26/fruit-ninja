/**
 * Admin Players Management View.
 */

import { adminApi } from '../api.js';

export async function renderPlayers(container) {
  container.innerHTML = `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex flex-wrap justify-between items-center gap-4 bg-slate-900 border border-white/10 p-5 rounded-2xl">
        <div>
          <h1 class="text-xl font-black text-white">Player Accounts & Banning</h1>
          <p class="text-xs text-slate-400">Search players, view profile performance histories, and suspend/ban accounts</p>
        </div>

        <div class="flex items-center gap-2">
          <input type="text" id="player-search-input" placeholder="Search by name or external ID..." class="px-4 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs w-64 placeholder-slate-500" />
          <button id="btn-search-players" class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer transition">
            Search
          </button>
        </div>
      </div>

      <!-- Players Table -->
      <div class="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-sm">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="text-slate-400 border-b border-white/10 uppercase pb-2 bg-slate-950/40">
              <th class="py-3 px-4">Display Name</th>
              <th class="py-3 px-4">Source</th>
              <th class="py-3 px-4">External ID</th>
              <th class="py-3 px-4">Last Seen</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="players-tbody" class="divide-y divide-white/5 text-slate-300">
            <tr><td colspan="6" class="text-center py-12 text-slate-500">Loading players...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Player Details Modal Container -->
    <div id="player-modal-container"></div>
  `;

  const tbody = container.querySelector('#players-tbody');
  const searchInput = container.querySelector('#player-search-input');
  const modalCont = container.querySelector('#player-modal-container');

  async function loadPlayers(query = '') {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-12 text-slate-500">Loading players...</td></tr>';
    try {
      const data = await adminApi.getPlayers(query);
      const players = data.players || [];
      if (players.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-12 text-slate-500">No players found</td></tr>';
        return;
      }

      tbody.innerHTML = players.map(p => `
        <tr class="hover:bg-white/5 transition">
          <td class="py-3 px-4 font-bold text-white flex items-center gap-2">
            <span>${p.display_name}</span>
            ${p.source === 'host' ? '<span class="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">Verified</span>' : ''}
          </td>
          <td class="py-3 px-4 capitalize font-medium text-slate-400">${p.source}</td>
          <td class="py-3 px-4 font-mono text-slate-400">${p.external_id || '-'}</td>
          <td class="py-3 px-4 font-mono text-slate-400">${new Date(p.last_seen_at).toLocaleDateString()}</td>
          <td class="py-3 px-4">
            ${p.banned ? '<span class="text-rose-400 font-bold">Banned</span>' : '<span class="text-emerald-400 font-bold">Active</span>'}
          </td>
          <td class="py-3 px-4 text-right space-x-2">
            <button class="btn-view-player px-2.5 py-1 rounded bg-slate-800 text-slate-200 hover:text-white font-bold cursor-pointer" data-id="${p.id}">
              Details
            </button>
            <button class="btn-toggle-ban px-2.5 py-1 rounded ${p.banned ? 'bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50' : 'bg-rose-600/30 text-rose-300 hover:bg-rose-600/50'} font-bold cursor-pointer" data-id="${p.id}" data-banned="${p.banned}">
              ${p.banned ? 'Unban' : 'Ban'}
            </button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-view-player').forEach(b => {
        b.addEventListener('click', () => openPlayerModal(b.dataset.id));
      });

      tbody.querySelectorAll('.btn-toggle-ban').forEach(b => {
        b.addEventListener('click', async () => {
          const isBanned = b.dataset.banned === '1';
          if (!confirm(`${isBanned ? 'Unban' : 'Ban'} this player?`)) return;
          try {
            await adminApi.setPlayerBanned(b.dataset.id, !isBanned);
            loadPlayers(searchInput.value.trim());
          } catch (err) {
            alert('Failed: ' + err.message);
          }
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-rose-400">Failed to load: ${err.message}</td></tr>`;
    }
  }

  async function openPlayerModal(playerId) {
    modalCont.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div class="max-w-lg w-full bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
          <div class="flex justify-between items-center pb-2 border-b border-white/10">
            <h3 class="text-base font-black text-white">Player Details</h3>
            <button id="btn-close-pmodal" class="w-8 h-8 rounded-full bg-slate-800 text-white font-bold cursor-pointer">✕</button>
          </div>
          <div id="pmodal-body" class="text-xs space-y-4">
            <div class="text-center py-6 text-slate-400">Loading details...</div>
          </div>
        </div>
      </div>
    `;

    modalCont.querySelector('#btn-close-pmodal').addEventListener('click', () => {
      modalCont.innerHTML = '';
    });

    try {
      const data = await adminApi.getPlayer(playerId);
      const { player, bests, recentSessions } = data;

      modalCont.querySelector('#pmodal-body').innerHTML = `
        <div class="flex justify-between items-center p-3 bg-slate-950 rounded-xl">
          <div>
            <div class="text-sm font-black text-white">${player.display_name}</div>
            <div class="text-[11px] text-slate-400 font-mono">ID: ${player.id}</div>
            ${player.external_id ? `<div class="text-[11px] text-amber-400 font-mono">Host ID: ${player.external_id}</div>` : ''}
          </div>
          <div>
            ${player.banned ? '<span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">BANNED</span>' : '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">ACTIVE</span>'}
          </div>
        </div>

        <div>
          <span class="font-bold text-slate-400 uppercase text-[10px]">Personal Best Scores:</span>
          <div class="grid grid-cols-3 gap-2 mt-1 text-center">
            <div class="p-2 bg-slate-950 rounded-lg"><span class="text-slate-400">Classic:</span> <span class="font-black text-white">${bests.classic || 0}</span></div>
            <div class="p-2 bg-slate-950 rounded-lg"><span class="text-slate-400">Arcade:</span> <span class="font-black text-white">${bests.arcade || 0}</span></div>
            <div class="p-2 bg-slate-950 rounded-lg"><span class="text-slate-400">Zen:</span> <span class="font-black text-white">${bests.zen || 0}</span></div>
          </div>
        </div>

        <div>
          <span class="font-bold text-slate-400 uppercase text-[10px]">Recent Sessions:</span>
          <div class="space-y-1 mt-1 max-h-40 overflow-y-auto">
            ${recentSessions.map(s => `
              <div class="p-2 bg-slate-950 rounded-lg flex justify-between font-mono text-[11px]">
                <span class="capitalize text-amber-300 font-bold">${s.mode}</span>
                <span class="text-white">${s.final_score ?? s.client_score ?? 0} pts (${s.status})</span>
                <span class="text-slate-500">${new Date(s.started_at).toLocaleDateString()}</span>
              </div>
            `).join('') || '<div class="text-slate-500 text-center py-2">No recent sessions</div>'}
          </div>
        </div>
      `;
    } catch (err) {
      modalCont.querySelector('#pmodal-body').innerHTML = `<div class="text-rose-400 py-4 text-center">Failed: ${err.message}</div>`;
    }
  }

  container.querySelector('#btn-search-players').addEventListener('click', () => {
    loadPlayers(searchInput.value.trim());
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadPlayers(searchInput.value.trim());
  });

  loadPlayers();
}
