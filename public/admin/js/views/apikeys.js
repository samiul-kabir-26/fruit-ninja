/**
 * Admin API Keys Management View.
 */

import { adminApi } from '../api.js';

export async function renderApiKeys(container) {
  container.innerHTML = `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex flex-wrap justify-between items-center gap-4 bg-slate-900 border border-white/10 p-5 rounded-2xl">
        <div>
          <h1 class="text-xl font-black text-white">API Keys (Integration)</h1>
          <p class="text-xs text-slate-400">Issue and revoke bearer keys used by host backends to pull events and query player stats</p>
        </div>

        <button id="btn-create-key" class="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-black shadow-lg cursor-pointer active:scale-95 transition">
          + Create API Key
        </button>
      </div>

      <!-- Keys Table -->
      <div class="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-sm">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="text-slate-400 border-b border-white/10 uppercase pb-2 bg-slate-950/40">
              <th class="py-3 px-4">Key Name</th>
              <th class="py-3 px-4">Key Prefix</th>
              <th class="py-3 px-4">Created Date</th>
              <th class="py-3 px-4">Last Used</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="keys-tbody" class="divide-y divide-white/5 text-slate-300">
            <tr><td colspan="6" class="text-center py-12 text-slate-500">Loading API keys...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modals Container -->
    <div id="key-modal-container"></div>
  `;

  const tbody = container.querySelector('#keys-tbody');
  const modalCont = container.querySelector('#key-modal-container');

  async function loadKeys() {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-12 text-slate-500">Loading API keys...</td></tr>';
    try {
      const data = await adminApi.getApiKeys();
      const keys = data.keys || [];
      if (keys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-12 text-slate-500">No API keys active. Click "+ Create API Key" above.</td></tr>';
        return;
      }

      tbody.innerHTML = keys.map(k => `
        <tr class="hover:bg-white/5 transition">
          <td class="py-3 px-4 font-bold text-white">${k.name}</td>
          <td class="py-3 px-4 font-mono text-amber-300">${k.prefix}••••••••</td>
          <td class="py-3 px-4 font-mono text-slate-400">${new Date(k.created_at).toLocaleDateString()}</td>
          <td class="py-3 px-4 font-mono text-slate-400">${k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</td>
          <td class="py-3 px-4">
            ${k.revoked_at ? '<span class="text-rose-400 font-bold">Revoked</span>' : '<span class="text-emerald-400 font-bold">Active</span>'}
          </td>
          <td class="py-3 px-4 text-right">
            ${!k.revoked_at ? `
              <button class="btn-revoke-key px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/40 font-bold cursor-pointer" data-id="${k.id}">
                Revoke
              </button>
            ` : '-'}
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-revoke-key').forEach(b => {
        b.addEventListener('click', async () => {
          if (!confirm('Revoke this API key? Applications using this key will immediately receive 401.')) return;
          try {
            await adminApi.revokeApiKey(b.dataset.id);
            loadKeys();
          } catch (err) {
            alert('Failed: ' + err.message);
          }
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-rose-400">Failed: ${err.message}</td></tr>`;
    }
  }

  container.querySelector('#btn-create-key').addEventListener('click', () => {
    modalCont.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <form id="form-create-key" class="max-w-md w-full bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
          <h3 class="text-lg font-black text-white">Create New API Key</h3>

          <div>
            <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Key Description / Name</label>
            <input type="text" id="key-name" required placeholder="Production Rewards Engine" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-medium" />
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" id="btn-cancel-kmodal" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer">Cancel</button>
            <button type="submit" class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer">Generate Key</button>
          </div>
        </form>
      </div>
    `;

    modalCont.querySelector('#btn-cancel-kmodal').addEventListener('click', () => {
      modalCont.innerHTML = '';
    });

    modalCont.querySelector('#form-create-key').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = modalCont.querySelector('#key-name').value.trim();

      try {
        const res = await adminApi.createApiKey(name);
        modalCont.innerHTML = `
          <div class="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div class="max-w-md w-full bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
              <h3 class="text-lg font-black text-white">API Key Generated</h3>
              <p class="text-xs text-amber-300 font-semibold">Copy this key now. It will NEVER be shown again!</p>
              <div class="p-3 bg-slate-950 rounded-xl border border-white/10 font-mono text-xs text-emerald-400 break-all select-all">
                ${res.apiKey}
              </div>
              <button id="btn-close-kdone" class="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer">
                I Have Saved The Key
              </button>
            </div>
          </div>
        `;
        modalCont.querySelector('#btn-close-kdone').addEventListener('click', () => {
          modalCont.innerHTML = '';
          loadKeys();
        });
      } catch (err) {
        alert('Failed: ' + err.message);
      }
    });
  });

  loadKeys();
}
