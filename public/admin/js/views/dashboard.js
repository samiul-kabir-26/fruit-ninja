import { adminApi } from '../api.js';

export async function renderDashboard(container) {
  container.innerHTML = `
    <div class="flex items-center justify-center p-12">
      <div class="text-slate-400 font-bold text-sm">Loading dashboard KPIs...</div>
    </div>
  `;

  try {
    const data = await adminApi.getDashboard();
    const { kpis, topScores, webhookHealth, recentEvents } = data;

    const classicSessions = kpis.sessionsByMode.find(m => m.mode === 'classic')?.count || 0;
    const arcadeSessions = kpis.sessionsByMode.find(m => m.mode === 'arcade')?.count || 0;
    const zenSessions = kpis.sessionsByMode.find(m => m.mode === 'zen')?.count || 0;

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Page Title & Header -->
        <div class="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 class="text-2xl font-black tracking-tight text-white">Dashboard Overview</h1>
            <p class="text-xs text-slate-400">Live operational metrics, player activity, and service status</p>
          </div>

          ${kpis.hasUnpublishedThemeChanges ? `
            <a href="#/theme" class="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2 hover:bg-amber-500/20 transition">
              <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              <span>Draft theme has unpublished changes</span>
            </a>
          ` : ''}
        </div>

        <!-- KPI Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Players Today -->
          <div class="bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-sm">
            <div class="text-xs font-bold uppercase tracking-wider text-slate-400">Players Today</div>
            <div class="text-3xl font-black text-white mt-1">${kpis.playersToday}</div>
            <div class="text-[11px] text-slate-500 mt-2">Active player accounts</div>
          </div>

          <!-- Sessions Today -->
          <div class="bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-sm">
            <div class="text-xs font-bold uppercase tracking-wider text-slate-400">Sessions Today</div>
            <div class="text-3xl font-black text-amber-400 mt-1">${kpis.sessionsToday}</div>
            <div class="text-[11px] text-slate-400 mt-2 flex gap-2">
              <span class="text-rose-400 font-semibold">C: ${classicSessions}</span>
              <span class="text-amber-400 font-semibold">A: ${arcadeSessions}</span>
              <span class="text-emerald-400 font-semibold">Z: ${zenSessions}</span>
            </div>
          </div>

          <!-- Events Last Hour -->
          <div class="bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-sm">
            <div class="text-xs font-bold uppercase tracking-wider text-slate-400">Events / Last Hour</div>
            <div class="text-3xl font-black text-sky-400 mt-1">${kpis.eventsLastHour}</div>
            <div class="text-[11px] text-slate-500 mt-2">Ingested into event outbox</div>
          </div>

          <!-- Avg Score (7d) -->
          <div class="bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-sm">
            <div class="text-xs font-bold uppercase tracking-wider text-slate-400">Avg Score (7 Days)</div>
            <div class="text-3xl font-black text-emerald-400 mt-1">${kpis.avgScorePast7d}</div>
            <div class="text-[11px] text-slate-500 mt-2">Across all completed games</div>
          </div>
        </div>

        <!-- Middle Row: Top Scores + Webhook Health -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Top Scores Table (2 cols) -->
          <div class="lg:col-span-2 bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-sm space-y-4">
            <div class="flex justify-between items-center">
              <h2 class="text-base font-black text-white">Top Scores Today</h2>
              <a href="#/leaderboard" class="text-xs font-bold text-amber-400 hover:text-amber-300">View All →</a>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <!-- Classic -->
              <div class="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-2">
                <div class="text-xs font-black text-rose-400 uppercase tracking-wider">Classic Mode</div>
                <div class="space-y-1.5 text-xs">
                  ${(topScores.classic || []).slice(0, 4).map((s, idx) => `
                    <div class="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                      <span class="text-slate-300 truncate max-w-[100px]">#${idx + 1} ${s.displayName}</span>
                      <span class="font-black text-white">${s.score}</span>
                    </div>
                  `).join('') || '<div class="text-slate-500 text-xs py-2">No scores recorded</div>'}
                </div>
              </div>

              <!-- Arcade -->
              <div class="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-2">
                <div class="text-xs font-black text-amber-400 uppercase tracking-wider">Arcade Mode</div>
                <div class="space-y-1.5 text-xs">
                  ${(topScores.arcade || []).slice(0, 4).map((s, idx) => `
                    <div class="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                      <span class="text-slate-300 truncate max-w-[100px]">#${idx + 1} ${s.displayName}</span>
                      <span class="font-black text-white">${s.score}</span>
                    </div>
                  `).join('') || '<div class="text-slate-500 text-xs py-2">No scores recorded</div>'}
                </div>
              </div>

              <!-- Zen -->
              <div class="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-2">
                <div class="text-xs font-black text-emerald-400 uppercase tracking-wider">Zen Mode</div>
                <div class="space-y-1.5 text-xs">
                  ${(topScores.zen || []).slice(0, 4).map((s, idx) => `
                    <div class="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                      <span class="text-slate-300 truncate max-w-[100px]">#${idx + 1} ${s.displayName}</span>
                      <span class="font-black text-white">${s.score}</span>
                    </div>
                  `).join('') || '<div class="text-slate-500 text-xs py-2">No scores recorded</div>'}
                </div>
              </div>
            </div>
          </div>

          <!-- Webhook Health Status (1 col) -->
          <div class="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-sm space-y-4">
            <div class="flex justify-between items-center">
              <h2 class="text-base font-black text-white">Webhook Health</h2>
              <a href="#/webhooks" class="text-xs font-bold text-amber-400 hover:text-amber-300">Manage →</a>
            </div>

            <div class="space-y-3">
              ${(webhookHealth || []).map(wh => {
                let badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
                if (wh.health === 'amber') badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                if (wh.health === 'red') badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/30';

                return `
                  <div class="p-3 bg-slate-950/60 rounded-xl border border-white/5 flex flex-col gap-1.5">
                    <div class="flex justify-between items-center">
                      <span class="text-xs font-bold text-white truncate max-w-[160px]">${wh.url}</span>
                      <span class="px-2 py-0.5 rounded text-[10px] font-black border ${badgeColor}">${wh.successRate24h}%</span>
                    </div>
                    <div class="text-[11px] text-slate-400 flex justify-between">
                      <span>${wh.total24h} deliveries (24h)</span>
                      <span>${wh.active ? 'Active' : 'Disabled'}</span>
                    </div>
                  </div>
                `;
              }).join('') || '<div class="text-slate-500 text-xs py-4 text-center">No webhook endpoints configured</div>'}
            </div>
          </div>
        </div>

        <!-- Recent Events Live Feed -->
        <div class="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-sm space-y-4">
          <div class="flex justify-between items-center">
            <div>
              <h2 class="text-base font-black text-white">Recent Event Stream</h2>
              <p class="text-xs text-slate-400">Latest gameplay and lifecycle events recorded in SQLite outbox</p>
            </div>
            <a href="#/events" class="text-xs font-bold text-amber-400 hover:text-amber-300">Open Explorer →</a>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="text-slate-400 border-b border-white/10 uppercase pb-2">
                  <th class="py-2">Time</th>
                  <th class="py-2">Event Type</th>
                  <th class="py-2">Player</th>
                  <th class="py-2">Mode</th>
                  <th class="py-2 text-right">Sequence</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5 text-slate-300">
                ${(recentEvents || []).map(ev => `
                  <tr class="hover:bg-white/5 transition">
                    <td class="py-2.5 font-mono text-slate-400">${new Date(ev.occurred_at).toLocaleTimeString()}</td>
                    <td class="py-2.5">
                      <span class="px-2 py-0.5 rounded bg-slate-800 border border-white/10 font-bold text-amber-300">${ev.type}</span>
                    </td>
                    <td class="py-2.5 font-medium text-white">${ev.p_display_name || 'Anonymous'}</td>
                    <td class="py-2.5 capitalize text-slate-400">${ev.s_mode || '-'}</td>
                    <td class="py-2.5 text-right font-mono text-slate-400">#${ev.seq}</td>
                  </tr>
                `).join('') || '<tr><td colspan="5" class="text-center py-6 text-slate-500">No events yet</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
        Failed to load dashboard: ${err.message}
      </div>
    `;
  }
}
