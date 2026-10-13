/**
 * Gameplay Settings Form View.
 */

import { adminApi } from '../api.js';

export async function renderSettings(container) {
  container.innerHTML = `
    <div class="flex items-center justify-center p-12">
      <div class="text-slate-400 font-bold text-sm">Loading gameplay settings...</div>
    </div>
  `;

  try {
    const settings = await adminApi.getSettings();

    container.innerHTML = `
      <div class="max-w-4xl space-y-6">
        <!-- Title & Version Info -->
        <div class="flex flex-wrap justify-between items-center gap-4 bg-slate-900 border border-white/10 p-5 rounded-2xl">
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-xl font-black text-white">Gameplay Parameters & Difficulty</h1>
              <span class="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-300 font-bold">Version ${settings.settingsVersion}</span>
            </div>
            <p class="text-xs text-slate-400">Tune physics, scoring multipliers, wave curves, and mode rules</p>
          </div>

          <button id="btn-save-settings" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-black shadow-lg cursor-pointer active:scale-95 transition">
            Save Settings
          </button>
        </div>

        <form id="settings-form" class="space-y-6">
          <!-- Modes Config -->
          <div class="bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 class="text-sm font-black uppercase tracking-wider text-amber-400">Game Modes & Rules</h2>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <!-- Classic -->
              <div class="p-4 bg-slate-950/60 rounded-xl border border-white/5 space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-xs font-black text-rose-400 uppercase">Classic Mode</span>
                  <input type="checkbox" id="mode-classic-enabled" ${settings.modes?.classic?.enabled ? 'checked' : ''} class="rounded accent-rose-500 cursor-pointer" />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-slate-400 mb-1">Starting Lives (1–5)</label>
                  <input type="number" id="classic-lives" min="1" max="5" value="${settings.modes?.classic?.lives || 3}" class="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-xs" />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-slate-400 mb-1">Life Recovery Interval (pts)</label>
                  <input type="number" id="classic-recovery" min="0" max="1000" value="${settings.modes?.classic?.lifeRecoveryEvery || 100}" class="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-xs" />
                </div>
              </div>

              <!-- Arcade -->
              <div class="p-4 bg-slate-950/60 rounded-xl border border-white/5 space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-xs font-black text-amber-400 uppercase">Arcade Mode</span>
                  <input type="checkbox" id="mode-arcade-enabled" ${settings.modes?.arcade?.enabled ? 'checked' : ''} class="rounded accent-amber-500 cursor-pointer" />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-slate-400 mb-1">Duration (30–180 s)</label>
                  <input type="number" id="arcade-duration" min="30" max="180" value="${settings.modes?.arcade?.durationSec || 60}" class="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-xs" />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-slate-400 mb-1">Bomb Point Penalty</label>
                  <input type="number" id="arcade-bomb-penalty" min="0" max="50" value="${settings.modes?.arcade?.bombPenalty || 10}" class="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-xs" />
                </div>
              </div>

              <!-- Zen -->
              <div class="p-4 bg-slate-950/60 rounded-xl border border-white/5 space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-xs font-black text-emerald-400 uppercase">Zen Mode</span>
                  <input type="checkbox" id="mode-zen-enabled" ${settings.modes?.zen?.enabled ? 'checked' : ''} class="rounded accent-emerald-500 cursor-pointer" />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-slate-400 mb-1">Duration (30–300 s)</label>
                  <input type="number" id="zen-duration" min="30" max="300" value="${settings.modes?.zen?.durationSec || 90}" class="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-xs" />
                </div>
              </div>
            </div>
          </div>

          <!-- Physics & Slicing -->
          <div class="bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 class="text-sm font-black uppercase tracking-wider text-amber-400">Physics & Blade Mechanics</h2>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label class="block font-bold text-slate-400 mb-1">Gravity (px/s²)</label>
                <input type="number" id="physics-gravity" min="800" max="2400" value="${settings.physics?.gravity || 1400}" class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white" />
                <p class="text-[10px] text-slate-500 mt-1">Default 1400. Controls flight curve height.</p>
              </div>

              <div>
                <label class="block font-bold text-slate-400 mb-1">Min Blade Cut Speed (px/s)</label>
                <input type="number" id="physics-min-speed" min="300" max="2000" value="${settings.physics?.minBladeSpeed || 900}" class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white" />
                <p class="text-[10px] text-slate-500 mt-1">Slow swipes don't cut fruit.</p>
              </div>

              <div>
                <label class="block font-bold text-slate-400 mb-1">Bomb Probability Cap</label>
                <input type="number" step="0.01" id="physics-bomb-cap" min="0" max="0.4" value="${settings.physics?.bombProbabilityCap || 0.18}" class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white" />
                <p class="text-[10px] text-slate-500 mt-1">Maximum bomb ratio per wave.</p>
              </div>
            </div>
          </div>

          <!-- Combos & Guest Play -->
          <div class="bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 class="text-sm font-black uppercase tracking-wider text-amber-400">Scoring & Identity</h2>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label class="block font-bold text-slate-400 mb-1">Combo Minimum Fruit</label>
                <input type="number" id="scoring-combo-min" min="2" max="6" value="${settings.scoring?.comboMin || 3}" class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white" />
              </div>

              <div>
                <label class="block font-bold text-slate-400 mb-1">Combo Bonus Per Fruit</label>
                <input type="number" id="scoring-combo-bonus" min="0" max="5" value="${settings.scoring?.comboBonusPerFruit || 1}" class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white" />
              </div>

              <div class="flex items-center gap-2 pt-4">
                <input type="checkbox" id="setting-guest-enabled" ${settings.guestPlayEnabled ? 'checked' : ''} class="w-4 h-4 rounded accent-amber-500 cursor-pointer" />
                <label for="setting-guest-enabled" class="font-bold text-slate-200 cursor-pointer">Allow Unauthenticated Guest Players</label>
              </div>
            </div>
          </div>
        </form>
      </div>
    `;

    const saveBtn = container.querySelector('#btn-save-settings');
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const updated = {
        modes: {
          classic: {
            enabled: container.querySelector('#mode-classic-enabled').checked,
            lives: Number(container.querySelector('#classic-lives').value),
            lifeRecoveryEvery: Number(container.querySelector('#classic-recovery').value)
          },
          arcade: {
            enabled: container.querySelector('#mode-arcade-enabled').checked,
            durationSec: Number(container.querySelector('#arcade-duration').value),
            bombPenalty: Number(container.querySelector('#arcade-bomb-penalty').value),
            specialChance: settings.modes?.arcade?.specialChance || 0.06,
            criticalChance: settings.modes?.arcade?.criticalChance || 0.02
          },
          zen: {
            enabled: container.querySelector('#mode-zen-enabled').checked,
            durationSec: Number(container.querySelector('#zen-duration').value)
          }
        },
        physics: {
          gravity: Number(container.querySelector('#physics-gravity').value),
          minBladeSpeed: Number(container.querySelector('#physics-min-speed').value),
          trailLength: settings.physics?.trailLength || 12,
          bombProbabilityCap: Number(container.querySelector('#physics-bomb-cap').value)
        },
        scoring: {
          comboMin: Number(container.querySelector('#scoring-combo-min').value),
          comboBonusPerFruit: Number(container.querySelector('#scoring-combo-bonus').value)
        },
        difficulty: settings.difficulty || [],
        guestPlayEnabled: container.querySelector('#setting-guest-enabled').checked
      };

      try {
        const res = await adminApi.updateSettings(updated);
        alert(`Settings saved successfully! Version bumped to v${res.settingsVersion}`);
        renderSettings(container);
      } catch (err) {
        alert('Failed to save settings: ' + err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Settings';
      }
    });
  } catch (err) {
    container.innerHTML = `
      <div class="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
        Failed to load settings: ${err.message}
      </div>
    `;
  }
}
