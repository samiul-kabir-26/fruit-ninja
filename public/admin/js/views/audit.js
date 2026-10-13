/**
 * Admin Audit Log View.
 */

import { adminApi } from '../api.js';

export async function renderAuditLog(container) {
  container.innerHTML = `
    <div class="space-y-4">
      <!-- Header -->
      <div class="bg-slate-900 border border-white/10 p-5 rounded-2xl">
        <h1 class="text-xl font-black text-white">Security & Audit Log</h1>
        <p class="text-xs text-slate-400">Append-only administrative action history recording logins, theme changes, and moderations</p>
      </div>

      <!-- Table -->
      <div class="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-sm">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="text-slate-400 border-b border-white/10 uppercase pb-2 bg-slate-950/40">
              <th class="py-3 px-4">Timestamp</th>
              <th class="py-3 px-4">Action</th>
              <th class="py-3 px-4">Target</th>
              <th class="py-3 px-4">Client IP</th>
              <th class="py-3 px-4">Details</th>
            </tr>
          </thead>
          <tbody id="audit-tbody" class="divide-y divide-white/5 text-slate-300">
            <tr><td colspan="5" class="text-center py-12 text-slate-500">Loading audit records...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = container.querySelector('#audit-tbody');

  try {
    const data = await adminApi.getAuditLog(100);
    const logs = data.logs || [];
    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-500">No audit records recorded yet</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(l => {
      let badgeClass = 'bg-slate-800 text-slate-300 border-white/10';
      if (l.action.includes('login')) badgeClass = 'bg-sky-950 text-sky-300 border-sky-500/30';
      if (l.action.includes('remove') || l.action.includes('ban') || l.action.includes('reset')) badgeClass = 'bg-rose-950 text-rose-300 border-rose-500/30';
      if (l.action.includes('publish') || l.action.includes('create')) badgeClass = 'bg-emerald-950 text-emerald-300 border-emerald-500/30';

      return `
        <tr class="hover:bg-white/5 transition">
          <td class="py-3 px-4 font-mono text-slate-400">${new Date(l.created_at).toLocaleString()}</td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded font-bold border text-[11px] ${badgeClass}">${l.action}</span>
          </td>
          <td class="py-3 px-4 font-mono font-medium text-white">${l.target || '-'}</td>
          <td class="py-3 px-4 font-mono text-slate-400">${l.ip || '-'}</td>
          <td class="py-3 px-4 font-mono text-slate-400 text-[11px] truncate max-w-sm">
            ${l.details_json || '-'}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-rose-400">Failed: ${err.message}</td></tr>`;
  }
}
