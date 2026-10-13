/**
 * Events Explorer View with Live Tail (SSE) and JSON Drawer.
 */

import { adminApi } from '../api.js';

export async function renderEvents(container) {
  let eventSource = null;
  let isLiveTail = false;

  container.innerHTML = `
    <div class="space-y-4">
      <!-- Header & Tools -->
      <div class="flex flex-wrap justify-between items-center gap-4 bg-slate-900 border border-white/10 p-5 rounded-2xl">
        <div>
          <h1 class="text-xl font-black text-white">Events Explorer & Outbox</h1>
          <p class="text-xs text-slate-400">Search and audit append-only gameplay and lifecycle events</p>
        </div>

        <div class="flex items-center gap-2">
          <!-- Live Tail Toggle -->
          <button id="btn-live-tail" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-white/10 flex items-center gap-2 cursor-pointer transition">
            <span id="live-indicator" class="w-2 h-2 rounded-full bg-slate-500"></span>
            <span>Live Tail</span>
          </button>

          <!-- Export Dropdown -->
          <button id="btn-export-ndjson" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-white/10 cursor-pointer transition">
            Export NDJSON
          </button>
          <button id="btn-export-csv" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-white/10 cursor-pointer transition">
            Export CSV
          </button>
        </div>
      </div>

      <!-- Filters Bar -->
      <div class="bg-slate-900 border border-white/10 p-4 rounded-2xl flex flex-wrap gap-3 items-center text-xs">
        <input type="text" id="filter-type" placeholder="Event Type (e.g. score.*, fruit.sliced)" class="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 w-52" />
        <input type="text" id="filter-session" placeholder="Session ID" class="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 w-44" />
        <input type="text" id="filter-q" placeholder="Search JSON data..." class="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 w-44" />

        <button id="btn-apply-filters" class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer transition">
          Filter
        </button>
        <button id="btn-clear-filters" class="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold cursor-pointer transition">
          Clear
        </button>
      </div>

      <!-- Events Table -->
      <div class="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="text-slate-400 border-b border-white/10 uppercase pb-2 bg-slate-950/40">
                <th class="py-3 px-4">Seq</th>
                <th class="py-3 px-4">Time</th>
                <th class="py-3 px-4">Type</th>
                <th class="py-3 px-4">Player</th>
                <th class="py-3 px-4">Session</th>
                <th class="py-3 px-4">Data Summary</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="events-table-body" class="divide-y divide-white/5 text-slate-300">
              <tr><td colspan="7" class="text-center py-12 text-slate-500">Loading events...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Sliding JSON Drawer Overlay -->
    <div id="json-drawer" class="fixed inset-y-0 right-0 w-full max-w-lg bg-slate-900 border-l border-white/10 shadow-2xl p-6 z-50 transform translate-x-full transition-transform duration-300 flex flex-col gap-4">
      <div class="flex justify-between items-center pb-2 border-b border-white/10">
        <div>
          <h3 class="text-base font-black text-white" id="drawer-title">Event Envelope</h3>
          <span class="text-xs text-slate-400 font-mono" id="drawer-id"></span>
        </div>
        <div class="flex items-center gap-2">
          <button id="btn-copy-json" class="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-amber-400 hover:bg-slate-700 cursor-pointer">Copy</button>
          <button id="btn-close-drawer" class="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold cursor-pointer">✕</button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto">
        <pre id="drawer-json" class="text-[11px] font-mono text-emerald-300 bg-slate-950 p-4 rounded-xl overflow-x-auto border border-white/5"></pre>
      </div>
    </div>

    <!-- Session Detail Modal Container -->
    <div id="session-modal-container"></div>
  `;

  const tbody = container.querySelector('#events-table-body');
  const drawer = container.querySelector('#json-drawer');
  const drawerTitle = container.querySelector('#drawer-title');
  const drawerId = container.querySelector('#drawer-id');
  const drawerJson = container.querySelector('#drawer-json');
  const modalCont = container.querySelector('#session-modal-container');

  container.querySelector('#btn-close-drawer').addEventListener('click', () => {
    drawer.classList.add('translate-x-full');
  });

  container.querySelector('#btn-copy-json').addEventListener('click', () => {
    navigator.clipboard.writeText(drawerJson.textContent);
    alert('JSON envelope copied to clipboard!');
  });

  async function loadEvents() {
    const types = container.querySelector('#filter-type').value.trim();
    const sessionId = container.querySelector('#filter-session').value.trim();
    const q = container.querySelector('#filter-q').value.trim();

    try {
      const data = await adminApi.getEvents({ types, sessionId, q, limit: 50 });
      renderRows(data.events || []);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-rose-400">Failed to load events: ${err.message}</td></tr>`;
    }
  }

  function renderRows(events) {
    if (events.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-12 text-slate-500">No events found matching criteria</td></tr>';
      return;
    }

    tbody.innerHTML = events.map(ev => {
      let badgeClass = 'bg-slate-800 text-slate-300 border-white/10';
      if (ev.type.startsWith('score.')) badgeClass = 'bg-emerald-950 text-emerald-300 border-emerald-500/30';
      if (ev.type.startsWith('session.')) badgeClass = 'bg-amber-950 text-amber-300 border-amber-500/30';
      if (ev.type.startsWith('bomb.')) badgeClass = 'bg-rose-950 text-rose-300 border-rose-500/30';

      const summary = JSON.stringify(ev.data || {}).slice(0, 45);

      return `
        <tr class="hover:bg-white/5 transition">
          <td class="py-3 px-4 font-mono font-bold text-slate-400">#${ev.seq}</td>
          <td class="py-3 px-4 font-mono text-slate-400">${new Date(ev.occurredAt).toLocaleTimeString()}</td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded font-bold border text-[11px] ${badgeClass}">${ev.type}</span>
          </td>
          <td class="py-3 px-4 font-medium text-white">${ev.player?.displayName || '-'}</td>
          <td class="py-3 px-4 font-mono text-[11px] text-amber-400/90 cursor-pointer hover:underline btn-session-detail" data-session="${ev.sessionId || ''}">
            ${ev.sessionId ? ev.sessionId.slice(0, 8) + '…' : '-'}
          </td>
          <td class="py-3 px-4 text-slate-400 font-mono text-[11px] truncate max-w-xs">${summary}</td>
          <td class="py-3 px-4 text-right">
            <button class="btn-inspect-event text-xs font-bold text-slate-300 hover:text-white px-2 py-1 rounded bg-slate-800 cursor-pointer" data-json='${JSON.stringify(ev).replace(/'/g, "&apos;")}'>
              Inspect
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach inspect handlers
    tbody.querySelectorAll('.btn-inspect-event').forEach(btn => {
      btn.addEventListener('click', () => {
        const ev = JSON.parse(btn.dataset.json);
        drawerTitle.textContent = ev.type;
        drawerId.textContent = ev.id;
        drawerJson.textContent = JSON.stringify(ev, null, 2);
        drawer.classList.remove('translate-x-full');
      });
    });

    // Attach session handlers
    tbody.querySelectorAll('.btn-session-detail').forEach(cell => {
      cell.addEventListener('click', () => {
        const sid = cell.dataset.session;
        if (sid) openSessionModal(sid);
      });
    });
  }

  async function openSessionModal(sessionId) {
    modalCont.innerHTML = `
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div class="max-w-2xl w-full max-h-[85vh] bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 overflow-hidden">
          <div class="flex justify-between items-center pb-2 border-b border-white/10">
            <div>
              <h3 class="text-lg font-black text-white">Session Detail</h3>
              <span class="text-xs font-mono text-slate-400">${sessionId}</span>
            </div>
            <button id="btn-close-session" class="w-8 h-8 rounded-full bg-slate-800 text-white font-bold cursor-pointer">✕</button>
          </div>
          <div id="session-modal-body" class="flex-1 overflow-y-auto space-y-4 text-xs">
            <div class="text-center py-8 text-slate-400">Loading session timeline...</div>
          </div>
        </div>
      </div>
    `;

    modalCont.querySelector('#btn-close-session').addEventListener('click', () => {
      modalCont.innerHTML = '';
    });

    try {
      const data = await adminApi.getSession(sessionId);
      const { session, validation, events } = data;

      modalCont.querySelector('#session-modal-body').innerHTML = `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div class="p-3 bg-slate-950 rounded-xl border border-white/5">
            <span class="text-[10px] uppercase text-slate-400 font-bold">Mode</span>
            <div class="text-sm font-black text-amber-400 uppercase">${session.mode}</div>
          </div>
          <div class="p-3 bg-slate-950 rounded-xl border border-white/5">
            <span class="text-[10px] uppercase text-slate-400 font-bold">Status</span>
            <div class="text-sm font-black text-emerald-400 uppercase">${session.status}</div>
          </div>
          <div class="p-3 bg-slate-950 rounded-xl border border-white/5">
            <span class="text-[10px] uppercase text-slate-400 font-bold">Final Score</span>
            <div class="text-sm font-black text-white">${session.final_score ?? '-'}</div>
          </div>
          <div class="p-3 bg-slate-950 rounded-xl border border-white/5">
            <span class="text-[10px] uppercase text-slate-400 font-bold">Client Claim</span>
            <div class="text-sm font-black text-slate-300">${session.client_score ?? '-'}</div>
          </div>
        </div>

        ${validation ? `
          <div class="p-4 bg-slate-950 rounded-xl border border-white/5 space-y-2">
            <span class="text-xs font-bold text-white uppercase">Anti-Cheat Validation Checks:</span>
            <div class="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
              <div>Sequence Contiguous: <span class="${validation.validation?.seqContiguous ? 'text-emerald-400' : 'text-rose-400'} font-bold">${String(validation.validation?.seqContiguous)}</span></div>
              <div>Monotonic Time: <span class="${validation.validation?.monotonicTime ? 'text-emerald-400' : 'text-rose-400'} font-bold">${String(validation.validation?.monotonicTime)}</span></div>
              <div>Airtime & Sequence: <span class="${validation.validation?.deterministicSpawnsOk ? 'text-emerald-400' : 'text-rose-400'} font-bold">${String(validation.validation?.deterministicSpawnsOk)}</span></div>
              <div>Slice Rate Normal: <span class="${validation.validation?.sliceRateOk ? 'text-emerald-400' : 'text-rose-400'} font-bold">${String(validation.validation?.sliceRateOk)}</span></div>
            </div>
            ${validation.rejectionReasons?.length ? `
              <div class="text-rose-400 mt-2 font-bold">Rejections: ${validation.rejectionReasons.join(', ')}</div>
            ` : ''}
          </div>
        ` : ''}

        <div class="space-y-2">
          <span class="text-xs font-bold text-white uppercase">Event Sequence (${events.length} events)</span>
          <div class="space-y-1">
            ${events.map(e => `
              <div class="p-2 bg-slate-950/60 rounded-lg flex justify-between font-mono text-[11px]">
                <span class="text-amber-300 font-bold">${e.type}</span>
                <span class="text-slate-400">${new Date(e.occurredAt).toLocaleTimeString()}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (err) {
      modalCont.querySelector('#session-modal-body').innerHTML = `<div class="text-rose-400 text-center py-4">Failed: ${err.message}</div>`;
    }
  }

  // Live Tail toggle (SSE)
  const tailBtn = container.querySelector('#btn-live-tail');
  const tailIndicator = container.querySelector('#live-indicator');

  tailBtn.addEventListener('click', () => {
    isLiveTail = !isLiveTail;
    if (isLiveTail) {
      tailIndicator.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-ping';
      tailBtn.classList.add('border-emerald-500/50', 'text-white');
      eventSource = new EventSource('/api/v1/admin/events/stream');
      eventSource.onmessage = (e) => {
        try {
          const envelope = JSON.parse(e.data);
          loadEvents();
        } catch {}
      };
    } else {
      tailIndicator.className = 'w-2 h-2 rounded-full bg-slate-500';
      tailBtn.classList.remove('border-emerald-500/50', 'text-white');
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    }
  });

  // Filter triggers
  container.querySelector('#btn-apply-filters').addEventListener('click', loadEvents);
  container.querySelector('#btn-clear-filters').addEventListener('click', () => {
    container.querySelector('#filter-type').value = '';
    container.querySelector('#filter-session').value = '';
    container.querySelector('#filter-q').value = '';
    loadEvents();
  });

  // Export handlers
  container.querySelector('#btn-export-csv').addEventListener('click', () => {
    window.open('/api/v1/admin/events/export?format=csv', '_blank');
  });
  container.querySelector('#btn-export-ndjson').addEventListener('click', () => {
    window.open('/api/v1/admin/events/export?format=ndjson', '_blank');
  });

  loadEvents();
}
