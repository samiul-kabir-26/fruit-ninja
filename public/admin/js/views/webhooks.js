/**
 * Admin Webhook Endpoints & Deliveries Management View.
 */

import { adminApi } from '../api.js';

export async function renderWebhooks(container) {
  container.innerHTML = `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex flex-wrap justify-between items-center gap-4 bg-slate-900 border border-white/10 p-5 rounded-2xl">
        <div>
          <h1 class="text-xl font-black text-white">Outbound Webhooks</h1>
          <p class="text-xs text-slate-400">Stream signed gameplay and score events to external host reward systems</p>
        </div>

        <button id="btn-add-webhook" class="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-black shadow-lg cursor-pointer active:scale-95 transition">
          + Add Endpoint
        </button>
      </div>

      <!-- Endpoints Table -->
      <div class="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-sm">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="text-slate-400 border-b border-white/10 uppercase pb-2 bg-slate-950/40">
              <th class="py-3 px-4">Endpoint URL</th>
              <th class="py-3 px-4">Subscribed Events</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4">Last Seq</th>
              <th class="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="webhooks-tbody" class="divide-y divide-white/5 text-slate-300">
            <tr><td colspan="5" class="text-center py-12 text-slate-500">Loading endpoints...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modals and Drawer Containers -->
    <div id="webhook-modal-container"></div>
    <div id="webhook-deliveries-drawer" class="fixed inset-y-0 right-0 w-full max-w-xl bg-slate-900 border-l border-white/10 shadow-2xl p-6 z-50 transform translate-x-full transition-transform duration-300 flex flex-col gap-4">
      <div class="flex justify-between items-center pb-2 border-b border-white/10">
        <div>
          <h3 class="text-base font-black text-white">Webhook Delivery Log</h3>
          <span class="text-xs text-slate-400" id="drawer-endpoint-url"></span>
        </div>
        <button id="btn-close-del-drawer" class="w-8 h-8 rounded-full bg-slate-800 text-white font-bold cursor-pointer">✕</button>
      </div>
      <div class="flex-1 overflow-y-auto space-y-2" id="deliveries-list-container"></div>
    </div>
  `;

  const tbody = container.querySelector('#webhooks-tbody');
  const modalCont = container.querySelector('#webhook-modal-container');
  const drawer = container.querySelector('#webhook-deliveries-drawer');
  const drawerUrl = container.querySelector('#drawer-endpoint-url');
  const deliveriesCont = container.querySelector('#deliveries-list-container');

  container.querySelector('#btn-close-del-drawer').addEventListener('click', () => {
    drawer.classList.add('translate-x-full');
  });

  async function loadEndpoints() {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-500">Loading endpoints...</td></tr>';
    try {
      const data = await adminApi.getWebhooks();
      const endpoints = data.endpoints || [];
      if (endpoints.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-500">No webhooks configured. Click "+ Add Endpoint" above.</td></tr>';
        return;
      }

      tbody.innerHTML = endpoints.map(e => `
        <tr class="hover:bg-white/5 transition">
          <td class="py-3 px-4 font-mono font-bold text-white max-w-xs truncate">${e.url}</td>
          <td class="py-3 px-4 font-mono text-[11px] text-amber-300">
            ${e.eventTypes.slice(0, 3).join(', ')}${e.eventTypes.length > 3 ? ` +${e.eventTypes.length - 3}` : ''}
          </td>
          <td class="py-3 px-4">
            ${e.active ? '<span class="text-emerald-400 font-bold">Active</span>' : '<span class="text-rose-400 font-bold">Disabled</span>'}
          </td>
          <td class="py-3 px-4 font-mono text-slate-400">#${e.lastSeq}</td>
          <td class="py-3 px-4 text-right space-x-1.5">
            <button class="btn-test-wh px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white font-bold cursor-pointer" data-id="${e.id}">
              Test
            </button>
            <button class="btn-log-wh px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white font-bold cursor-pointer" data-id="${e.id}" data-url="${e.url}">
              Log
            </button>
            <button class="btn-rotate-wh px-2 py-1 rounded bg-slate-800 text-amber-400 hover:bg-slate-700 font-bold cursor-pointer" data-id="${e.id}">
              Rotate
            </button>
            <button class="btn-delete-wh px-2 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/40 font-bold cursor-pointer" data-id="${e.id}">
              Delete
            </button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-test-wh').forEach(b => {
        b.addEventListener('click', async () => {
          b.textContent = 'Sending...';
          try {
            const res = await adminApi.testWebhook(b.dataset.id);
            alert(res.delivered ? 'Test event delivered successfully (2xx)!' : 'Delivery attempted, but failed or timed out.');
          } catch (err) {
            alert('Test error: ' + err.message);
          } finally {
            b.textContent = 'Test';
          }
        });
      });

      tbody.querySelectorAll('.btn-rotate-wh').forEach(b => {
        b.addEventListener('click', async () => {
          if (!confirm('Rotate secret? The old secret will remain valid for 24 hours.')) return;
          try {
            const res = await adminApi.rotateWebhookSecret(b.dataset.id);
            showSecretModal(res.secret, 'Rotated Webhook Secret (Copy Now)');
          } catch (err) {
            alert('Failed: ' + err.message);
          }
        });
      });

      tbody.querySelectorAll('.btn-delete-wh').forEach(b => {
        b.addEventListener('click', async () => {
          if (!confirm('Delete this webhook endpoint permanently?')) return;
          try {
            await adminApi.deleteWebhook(b.dataset.id);
            loadEndpoints();
          } catch (err) {
            alert('Failed: ' + err.message);
          }
        });
      });

      tbody.querySelectorAll('.btn-log-wh').forEach(b => {
        b.addEventListener('click', () => {
          openDeliveriesDrawer(b.dataset.id, b.dataset.url);
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-rose-400">Failed: ${err.message}</td></tr>`;
    }
  }

  function showSecretModal(secret, title = 'Webhook Secret Generated') {
    modalCont.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div class="max-w-md w-full bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
          <h3 class="text-lg font-black text-white">${title}</h3>
          <p class="text-xs text-amber-300 font-semibold">Copy this secret now. It will NEVER be shown again!</p>
          <div class="p-3 bg-slate-950 rounded-xl border border-white/10 font-mono text-xs text-emerald-400 break-all select-all">
            ${secret}
          </div>
          <button id="btn-close-secret" class="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer">
            I Have Saved The Secret
          </button>
        </div>
      </div>
    `;
    modalCont.querySelector('#btn-close-secret').addEventListener('click', () => {
      modalCont.innerHTML = '';
    });
  }

  async function openDeliveriesDrawer(endpointId, endpointUrl) {
    drawerUrl.textContent = endpointUrl;
    deliveriesCont.innerHTML = '<div class="text-center py-8 text-slate-500 text-xs">Loading deliveries...</div>';
    drawer.classList.remove('translate-x-full');

    try {
      const data = await adminApi.getWebhookDeliveries(endpointId);
      const list = data.deliveries || [];
      if (list.length === 0) {
        deliveriesCont.innerHTML = '<div class="text-center py-8 text-slate-500 text-xs">No delivery attempts yet</div>';
        return;
      }

      deliveriesCont.innerHTML = list.map(d => `
        <div class="p-3 bg-slate-950 rounded-xl border border-white/5 space-y-2 text-xs">
          <div class="flex justify-between items-center">
            <span class="font-mono text-slate-400">#${d.first_seq}–${d.last_seq} (${d.event_count} events)</span>
            <span class="px-2 py-0.5 rounded font-black text-[10px] uppercase ${d.status === 'succeeded' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950 text-rose-300 border border-rose-500/30'}">
              ${d.status} (${d.last_status_code || 'error'})
            </span>
          </div>
          ${d.last_error ? `<div class="text-rose-400 text-[11px] font-mono">Error: ${d.last_error}</div>` : ''}
          ${d.last_response_snippet ? `<pre class="text-[10px] font-mono text-slate-400 bg-slate-900 p-2 rounded truncate">${d.last_response_snippet}</pre>` : ''}
          <div class="flex justify-between items-center text-[11px] text-slate-500 pt-1">
            <span>Attempts: ${d.attempts}</span>
            <button class="btn-redeliver text-amber-400 hover:underline font-bold cursor-pointer" data-id="${d.id}">Redeliver Now</button>
          </div>
        </div>
      `).join('');

      deliveriesCont.querySelectorAll('.btn-redeliver').forEach(b => {
        b.addEventListener('click', async () => {
          b.textContent = 'Retrying...';
          await adminApi.redeliverWebhook(b.dataset.id);
          openDeliveriesDrawer(endpointId, endpointUrl);
        });
      });
    } catch (err) {
      deliveriesCont.innerHTML = `<div class="text-rose-400 text-xs">Failed: ${err.message}</div>`;
    }
  }

  container.querySelector('#btn-add-webhook').addEventListener('click', () => {
    modalCont.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <form id="form-create-wh" class="max-w-md w-full bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
          <h3 class="text-lg font-black text-white">Add Webhook Endpoint</h3>

          <div>
            <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Target URL</label>
            <input type="url" id="wh-url" required placeholder="https://api.yourcompany.com/webhooks/blade-fruit" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-medium" />
          </div>

          <div>
            <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Subscribed Events</label>
            <div class="space-y-1.5 text-xs text-slate-300">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" class="wh-ev" value="session.ended" checked class="rounded accent-amber-500" />
                <span>session.ended</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" class="wh-ev" value="score.submitted" checked class="rounded accent-amber-500" />
                <span>score.submitted</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" class="wh-ev" value="leaderboard.new_high_score" checked class="rounded accent-amber-500" />
                <span>leaderboard.new_high_score</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" class="wh-ev" value="player.first_game" checked class="rounded accent-amber-500" />
                <span>player.first_game</span>
              </label>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" id="btn-cancel-wh" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer">Cancel</button>
            <button type="submit" class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer">Create Endpoint</button>
          </div>
        </form>
      </div>
    `;

    modalCont.querySelector('#btn-cancel-wh').addEventListener('click', () => {
      modalCont.innerHTML = '';
    });

    modalCont.querySelector('#form-create-wh').addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = modalCont.querySelector('#wh-url').value.trim();
      const eventTypes = Array.from(modalCont.querySelectorAll('.wh-ev:checked')).map(cb => cb.value);

      try {
        const res = await adminApi.createWebhook({ url, eventTypes });
        modalCont.innerHTML = '';
        showSecretModal(res.secret, 'Webhook Created Successfully');
        loadEndpoints();
      } catch (err) {
        alert('Failed: ' + err.message);
      }
    });
  });

  loadEndpoints();
}
