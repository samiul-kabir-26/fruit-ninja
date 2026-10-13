/**
 * Admin Theme Editor View.
 * Slot List | Slot Editor (with Hitbox Preview) | Live Iframe Attract Preview.
 */

import { adminApi } from '../api.js';

export async function renderTheme(container) {
  container.innerHTML = `
    <div class="flex items-center justify-center p-12">
      <div class="text-slate-400 font-bold text-sm">Loading theme editor...</div>
    </div>
  `;

  try {
    let themeData = await adminApi.getTheme('draft');
    let selectedSlotKey = themeData.objects[0]?.key || 'fruit.apple';

    function renderEditor() {
      const selectedObj = themeData.objects.find(o => o.key === selectedSlotKey);
      const isUiSlot = selectedSlotKey === 'ui';
      const isAudioSlot = selectedSlotKey === 'audio';

      container.innerHTML = `
        <div class="space-y-4">
          <!-- Top Bar: Title, Publish / Reset / Export / Import -->
          <div class="flex flex-wrap justify-between items-center gap-4 bg-slate-900 border border-white/10 p-4 rounded-2xl">
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-xl font-black text-white">Theme & Sprite Editor</h1>
                <span class="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">Draft Mode</span>
              </div>
              <p class="text-xs text-slate-400">Re-skin fruits, hazards, blade glow, UI and audio without redeploying</p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button id="btn-theme-export" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-white/10 cursor-pointer active:scale-95 transition">
                📦 Export ZIP
              </button>

              <label class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-white/10 cursor-pointer active:scale-95 transition">
                📥 Import ZIP
                <input type="file" id="input-theme-import" accept=".zip" class="hidden" />
              </label>

              <button id="btn-theme-reset-all" class="px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-xs font-bold border border-rose-800/40 cursor-pointer active:scale-95 transition">
                ↺ Reset All
              </button>

              <button id="btn-theme-publish" class="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-black shadow-lg cursor-pointer active:scale-95 transition">
                🚀 Publish Changes
              </button>
            </div>
          </div>

          <!-- Main 3-Pane Layout -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-14rem)]">
            <!-- Left Pane: Slot List (3 cols) -->
            <div class="lg:col-span-3 bg-slate-900 border border-white/10 rounded-2xl p-4 overflow-y-auto space-y-4">
              <!-- Fruits Group -->
              <div>
                <div class="flex justify-between items-center mb-2 px-1">
                  <span class="text-[11px] font-black uppercase tracking-wider text-slate-400">Fruits & Custom</span>
                  <button id="btn-add-object" class="text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer">+ Add</button>
                </div>
                <div class="space-y-1">
                  ${themeData.objects.filter(o => o.kind === 'fruit').map(obj => `
                    <button data-key="${obj.key}" class="btn-slot-item w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between transition cursor-pointer ${obj.key === selectedSlotKey ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-300 hover:bg-white/5'}">
                      <div class="flex items-center gap-2 truncate">
                        <span class="w-3 h-3 rounded-full" style="background-color: ${obj.juiceColor}"></span>
                        <span class="truncate">${obj.label}</span>
                      </div>
                      ${!obj.enabled ? '<span class="text-[10px] text-slate-500">Off</span>' : ''}
                    </button>
                  `).join('')}
                </div>
              </div>

              <!-- Hazards Group -->
              <div>
                <div class="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 px-1">Hazards</div>
                <div class="space-y-1">
                  ${themeData.objects.filter(o => o.kind === 'bomb').map(obj => `
                    <button data-key="${obj.key}" class="btn-slot-item w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between transition cursor-pointer ${obj.key === selectedSlotKey ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-300 hover:bg-white/5'}">
                      <div class="flex items-center gap-2">
                        <span>💣</span>
                        <span>${obj.label}</span>
                      </div>
                    </button>
                  `).join('')}
                </div>
              </div>

              <!-- Specials Group -->
              <div>
                <div class="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 px-1">Arcade Specials</div>
                <div class="space-y-1">
                  ${themeData.objects.filter(o => o.kind === 'special').map(obj => `
                    <button data-key="${obj.key}" class="btn-slot-item w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between transition cursor-pointer ${obj.key === selectedSlotKey ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-300 hover:bg-white/5'}">
                      <div class="flex items-center gap-2">
                        <span class="w-3 h-3 rounded-full" style="background-color: ${obj.juiceColor}"></span>
                        <span>${obj.label}</span>
                      </div>
                    </button>
                  `).join('')}
                </div>
              </div>

              <!-- UI & Branding Group -->
              <div>
                <div class="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 px-1">Branding & UI</div>
                <div class="space-y-1">
                  <button data-key="ui" class="btn-slot-item w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center gap-2 transition cursor-pointer ${selectedSlotKey === 'ui' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-300 hover:bg-white/5'}">
                    <span>🎨</span>
                    <span>Colors, Blade, Logo</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Middle Pane: Slot Editor with Hitbox Canvas (5 cols) -->
            <div class="lg:col-span-5 bg-slate-900 border border-white/10 rounded-2xl p-5 overflow-y-auto space-y-4">
              ${renderSlotEditorContent(selectedObj, isUiSlot, isAudioSlot)}
            </div>

            <!-- Right Pane: Live Iframe Attract Preview (4 cols) -->
            <div class="lg:col-span-4 bg-slate-900 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
              <div class="flex justify-between items-center text-xs">
                <span class="font-black text-slate-400 uppercase tracking-wider">Live In-Game Preview</span>
                <span class="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Live Attract
                </span>
              </div>
              <div class="flex-1 rounded-xl overflow-hidden border border-white/10 bg-slate-950 relative shadow-inner">
                <iframe id="theme-preview-frame" src="/play?preview=draft" class="w-full h-full border-0"></iframe>
              </div>
            </div>
          </div>
        </div>

        <!-- Add Custom Object Modal Container -->
        <div id="modal-container"></div>
      `;

      attachEditorEvents();
    }

    function renderSlotEditorContent(obj, isUi, isAudio) {
      if (isUi) {
        const ui = themeData.ui || {};
        return `
          <div class="space-y-4">
            <h2 class="text-base font-black text-white">UI & Branding Customization</h2>

            <!-- Title Text -->
            <div>
              <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Game Title</label>
              <input type="text" id="ui-title" value="${ui.title || 'Blade Fruit'}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-medium focus:border-amber-400" />
            </div>

            <!-- Logo Upload -->
            <div>
              <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Logo Image</label>
              <div class="flex items-center gap-3">
                <img src="${ui.logo || '/assets/default/ui/logo.webp'}" class="w-24 h-12 object-contain bg-slate-950 rounded-lg p-1 border border-white/10" />
                <label class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer">
                  Replace Logo
                  <input type="file" id="upload-ui-logo" accept="image/png,image/webp,image/jpeg" class="hidden" />
                </label>
              </div>
            </div>

            <!-- Background Upload -->
            <div>
              <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Dojo Background Image</label>
              <div class="flex items-center gap-3">
                <img src="${ui.background || '/assets/default/ui/wood_background.webp'}" class="w-24 h-14 object-cover bg-slate-950 rounded-lg border border-white/10" />
                <label class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer">
                  Replace Background
                  <input type="file" id="upload-ui-bg" accept="image/png,image/webp,image/jpeg" class="hidden" />
                </label>
              </div>
            </div>

            <!-- Blade Colors -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Blade Core Color</label>
                <div class="flex items-center gap-2">
                  <input type="color" id="ui-blade-color" value="${ui.bladeColor || '#ffffff'}" class="w-9 h-9 rounded-lg bg-transparent cursor-pointer" />
                  <span class="text-xs text-slate-300 font-mono">${ui.bladeColor || '#ffffff'}</span>
                </div>
              </div>
              <div>
                <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Blade Glow Color</label>
                <div class="flex items-center gap-2">
                  <input type="color" id="ui-blade-glow" value="${ui.bladeGlow || '#7dd3fc'}" class="w-9 h-9 rounded-lg bg-transparent cursor-pointer" />
                  <span class="text-xs text-slate-300 font-mono">${ui.bladeGlow || '#7dd3fc'}</span>
                </div>
              </div>
            </div>

            <button id="btn-save-ui" class="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer active:scale-95 transition">
              Save UI Settings
            </button>
          </div>
        `;
      }

      if (!obj) {
        return '<div class="text-slate-500 text-xs py-8 text-center">Select a slot on the left to edit</div>';
      }

      return `
        <div class="space-y-4">
          <div class="flex justify-between items-start">
            <div>
              <h2 class="text-base font-black text-white">${obj.label}</h2>
              <span class="text-[10px] font-mono text-slate-400">${obj.key}</span>
            </div>
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-1.5 text-xs text-slate-300 font-bold cursor-pointer">
                <input type="checkbox" id="obj-enabled" ${obj.enabled ? 'checked' : ''} class="rounded accent-amber-500 cursor-pointer" />
                <span>Enabled</span>
              </label>
              ${!obj.builtin ? `
                <button id="btn-delete-object" class="text-xs text-rose-400 hover:text-rose-300 font-bold px-2 py-1 rounded bg-rose-500/10 cursor-pointer">Delete</button>
              ` : `
                <button id="btn-reset-slot" class="text-xs text-slate-400 hover:text-slate-300 font-bold px-2 py-1 rounded bg-slate-800 cursor-pointer">Reset</button>
              `}
            </div>
          </div>

          <!-- Sprite & Hitbox Preview -->
          <div class="p-3 bg-slate-950 rounded-xl border border-white/10 flex flex-col items-center">
            <span class="text-[10px] uppercase font-bold text-slate-400 mb-2">Hitbox & Radius Overlay (${obj.radius}px)</span>
            <div class="relative w-48 h-48 bg-slate-900/80 rounded-xl flex items-center justify-center overflow-hidden border border-white/5">
              <img id="preview-whole-img" src="${obj.image || '/assets/default/sprites/apple.webp'}" class="w-36 h-36 object-contain" />
              <!-- Hitbox Circle Overlay -->
              <div id="hitbox-overlay" class="absolute rounded-full border-2 border-emerald-400/80 bg-emerald-400/10 pointer-events-none" style="width: ${obj.radius * 2 * 0.7}px; height: ${obj.radius * 2 * 0.7}px;"></div>
            </div>
          </div>

          <!-- Upload Sprites -->
          <div class="space-y-2">
            <label class="block text-xs font-bold uppercase text-slate-400">Sprites (Whole & Halves)</label>
            <div class="grid grid-cols-3 gap-2">
              <label class="p-2.5 rounded-xl bg-slate-950 border border-white/10 flex flex-col items-center gap-1 cursor-pointer hover:border-amber-400 transition text-center">
                <span class="text-[10px] text-slate-400 font-bold">Whole</span>
                <span class="text-xs text-amber-400 font-bold">Upload</span>
                <input type="file" id="upload-whole" accept="image/png,image/webp,image/jpeg" class="hidden" />
              </label>

              <label class="p-2.5 rounded-xl bg-slate-950 border border-white/10 flex flex-col items-center gap-1 cursor-pointer hover:border-amber-400 transition text-center">
                <span class="text-[10px] text-slate-400 font-bold">Left Half</span>
                <span class="text-xs text-amber-400 font-bold">Upload</span>
                <input type="file" id="upload-half-left" accept="image/png,image/webp,image/jpeg" class="hidden" />
              </label>

              <label class="p-2.5 rounded-xl bg-slate-950 border border-white/10 flex flex-col items-center gap-1 cursor-pointer hover:border-amber-400 transition text-center">
                <span class="text-[10px] text-slate-400 font-bold">Right Half</span>
                <span class="text-xs text-amber-400 font-bold">Upload</span>
                <input type="file" id="upload-half-right" accept="image/png,image/webp,image/jpeg" class="hidden" />
              </label>
            </div>
            <p class="text-[10px] text-slate-500">Halves are optional. If omitted, the game automatically splits the sprite in two along the swipe angle.</p>
          </div>

          <!-- Numeric properties form -->
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label class="block font-bold text-slate-400 mb-1">Hitbox Radius (px)</label>
              <input type="number" id="obj-radius" min="15" max="100" value="${obj.radius}" class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white" />
            </div>

            <div>
              <label class="block font-bold text-slate-400 mb-1">Base Points</label>
              <input type="number" id="obj-points" min="0" max="50" value="${obj.points}" class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white" />
            </div>

            <div>
              <label class="block font-bold text-slate-400 mb-1">Spawn Weight</label>
              <input type="number" id="obj-spawn-weight" min="1" max="100" value="${obj.spawnWeight}" class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white" />
            </div>

            <div>
              <label class="block font-bold text-slate-400 mb-1">Juice Splash Color</label>
              <div class="flex items-center gap-2">
                <input type="color" id="obj-juice-color" value="${obj.juiceColor}" class="w-8 h-8 rounded bg-transparent cursor-pointer" />
                <span id="obj-juice-hex" class="font-mono text-slate-300">${obj.juiceColor}</span>
              </div>
            </div>
          </div>

          <button id="btn-save-object" class="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer active:scale-95 transition">
            Save Object Changes
          </button>
        </div>
      `;
    }

    function attachEditorEvents() {
      // Slot navigation
      container.querySelectorAll('.btn-slot-item').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedSlotKey = btn.dataset.key;
          renderEditor();
        });
      });

      // Export Theme ZIP
      container.querySelector('#btn-theme-export')?.addEventListener('click', async () => {
        try {
          const blob = await adminApi.exportTheme();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'blade-fruit-theme.zip';
          a.click();
        } catch (err) {
          alert('Export failed: ' + err.message);
        }
      });

      // Import Theme ZIP
      container.querySelector('#input-theme-import')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          await adminApi.importTheme(file);
          themeData = await adminApi.getTheme('draft');
          renderEditor();
          syncPreviewIframe();
          alert('Theme imported successfully into draft.');
        } catch (err) {
          alert('Import failed: ' + err.message);
        }
      });

      // Reset All to default
      container.querySelector('#btn-theme-reset-all')?.addEventListener('click', async () => {
        if (!confirm('Reset entire theme draft to bundled defaults?')) return;
        try {
          await adminApi.resetTheme();
          themeData = await adminApi.getTheme('draft');
          renderEditor();
          syncPreviewIframe();
        } catch (err) {
          alert('Reset failed: ' + err.message);
        }
      });

      // Publish draft
      container.querySelector('#btn-theme-publish')?.addEventListener('click', async () => {
        if (!confirm('Publish draft theme live to all players?')) return;
        try {
          const res = await adminApi.publishTheme();
          alert(`Theme published successfully! New version: v${res.themeVersion}`);
          syncPreviewIframe();
        } catch (err) {
          alert('Publish failed: ' + err.message);
        }
      });

      // Save UI Block
      container.querySelector('#btn-save-ui')?.addEventListener('click', async () => {
        const title = container.querySelector('#ui-title')?.value;
        const bladeColor = container.querySelector('#ui-blade-color')?.value;
        const bladeGlow = container.querySelector('#ui-blade-glow')?.value;

        await adminApi.updateThemeUi({ title, bladeColor, bladeGlow });
        themeData = await adminApi.getTheme('draft');
        syncPreviewIframe();
        alert('UI settings saved to draft.');
      });

      // Logo upload
      container.querySelector('#upload-ui-logo')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await adminApi.uploadMedia(file, 'ui.logo');
        themeData = await adminApi.getTheme('draft');
        renderEditor();
        syncPreviewIframe();
      });

      // Background upload
      container.querySelector('#upload-ui-bg')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await adminApi.uploadMedia(file, 'ui.background');
        themeData = await adminApi.getTheme('draft');
        renderEditor();
        syncPreviewIframe();
      });

      // Object properties save
      container.querySelector('#btn-save-object')?.addEventListener('click', async () => {
        const radius = Number(container.querySelector('#obj-radius')?.value);
        const points = Number(container.querySelector('#obj-points')?.value);
        const spawnWeight = Number(container.querySelector('#obj-spawn-weight')?.value);
        const juiceColor = container.querySelector('#obj-juice-color')?.value;
        const enabled = container.querySelector('#obj-enabled')?.checked;

        await adminApi.updateThemeObject(selectedSlotKey, {
          radius,
          points,
          spawnWeight,
          juiceColor,
          enabled
        });
        themeData = await adminApi.getTheme('draft');
        syncPreviewIframe();
        alert('Object saved to draft.');
      });

      // Radius slider hitbox resize live update
      container.querySelector('#obj-radius')?.addEventListener('input', (e) => {
        const rad = Number(e.target.value);
        const overlay = container.querySelector('#hitbox-overlay');
        if (overlay) {
          overlay.style.width = `${rad * 2 * 0.7}px`;
          overlay.style.height = `${rad * 2 * 0.7}px`;
        }
      });

      // Whole sprite upload
      container.querySelector('#upload-whole')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await adminApi.uploadMedia(file, `${selectedSlotKey}.image`);
        themeData = await adminApi.getTheme('draft');
        renderEditor();
        syncPreviewIframe();
      });

      // Half left upload
      container.querySelector('#upload-half-left')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await adminApi.uploadMedia(file, `${selectedSlotKey}.halfLeft`);
        themeData = await adminApi.getTheme('draft');
        renderEditor();
        syncPreviewIframe();
      });

      // Half right upload
      container.querySelector('#upload-half-right')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await adminApi.uploadMedia(file, `${selectedSlotKey}.halfRight`);
        themeData = await adminApi.getTheme('draft');
        renderEditor();
        syncPreviewIframe();
      });

      // Reset slot
      container.querySelector('#btn-reset-slot')?.addEventListener('click', async () => {
        await adminApi.resetSlot(`${selectedSlotKey}.image`);
        await adminApi.resetSlot(`${selectedSlotKey}.halfLeft`);
        await adminApi.resetSlot(`${selectedSlotKey}.halfRight`);
        themeData = await adminApi.getTheme('draft');
        renderEditor();
        syncPreviewIframe();
      });

      // Delete custom object
      container.querySelector('#btn-delete-object')?.addEventListener('click', async () => {
        if (!confirm(`Delete custom object "${selectedSlotKey}"?`)) return;
        await adminApi.deleteThemeObject(selectedSlotKey);
        themeData = await adminApi.getTheme('draft');
        selectedSlotKey = themeData.objects[0]?.key || 'fruit.apple';
        renderEditor();
        syncPreviewIframe();
      });

      // Add Custom Object Modal
      container.querySelector('#btn-add-object')?.addEventListener('click', () => {
        openAddObjectModal();
      });
    }

    function syncPreviewIframe() {
      const frame = document.getElementById('theme-preview-frame');
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: 'bf:theme-updated' }, '*');
      }
    }

    function openAddObjectModal() {
      const modalCont = container.querySelector('#modal-container');
      modalCont.innerHTML = `
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form id="form-add-object" class="max-w-md w-full bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 class="text-lg font-black text-white">Add Custom Fruit / Mascot</h3>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Key identifier (e.g. fruit.bird)</label>
              <input type="text" id="add-key" required placeholder="fruit.bird" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-medium" />
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Display Label</label>
              <input type="text" id="add-label" required placeholder="Brand Bird" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-medium" />
            </div>

            <div class="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label class="block font-bold text-slate-400 mb-1">Radius (px)</label>
                <input type="number" id="add-radius" value="44" min="20" max="100" class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white" />
              </div>
              <div>
                <label class="block font-bold text-slate-400 mb-1">Points</label>
                <input type="number" id="add-points" value="1" min="1" max="10" class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white" />
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Splash Color</label>
              <input type="color" id="add-color" value="#38bdf8" class="w-10 h-10 rounded bg-transparent cursor-pointer" />
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button type="button" id="btn-cancel-add" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer">Cancel</button>
              <button type="submit" class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer">Create Object</button>
            </div>
          </form>
        </div>
      `;

      modalCont.querySelector('#btn-cancel-add').addEventListener('click', () => {
        modalCont.innerHTML = '';
      });

      modalCont.querySelector('#form-add-object').addEventListener('submit', async (e) => {
        e.preventDefault();
        const key = modalCont.querySelector('#add-key').value.trim();
        const label = modalCont.querySelector('#add-label').value.trim();
        const radius = Number(modalCont.querySelector('#add-radius').value);
        const points = Number(modalCont.querySelector('#add-points').value);
        const juiceColor = modalCont.querySelector('#add-color').value;

        try {
          await adminApi.createThemeObject({
            key,
            kind: 'fruit',
            label,
            radius,
            points,
            spawnWeight: 10,
            juiceColor
          });
          modalCont.innerHTML = '';
          themeData = await adminApi.getTheme('draft');
          selectedSlotKey = key;
          renderEditor();
          syncPreviewIframe();
        } catch (err) {
          alert('Failed to add object: ' + err.message);
        }
      });
    }

    renderEditor();
  } catch (err) {
    container.innerHTML = `
      <div class="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
        Failed to load theme editor: ${err.message}
      </div>
    `;
  }
}
