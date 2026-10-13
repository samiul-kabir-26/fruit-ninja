/**
 * Guest Nickname Prompt Modal.
 */

import { api } from '../api.js';

export class NicknameModal {
  constructor(containerEl, onIdentified) {
    this.container = containerEl;
    this.onIdentified = onIdentified;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div id="nick-root" class="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 select-none z-50 hidden">
        <form id="nick-form" class="flex flex-col items-center max-w-sm w-full bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl gap-5 text-center">
          <div class="flex flex-col items-center gap-1">
            <span class="text-3xl">🗡️</span>
            <h2 class="text-2xl font-black italic text-white tracking-tight">WHO GOES THERE?</h2>
            <p class="text-xs text-slate-400">Choose a nickname for your blade on the leaderboard</p>
          </div>

          <div class="w-full text-left">
            <input type="text" id="nick-input" maxlength="16" placeholder="NinjaName"
              class="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/20 text-white font-bold placeholder-slate-600 focus:outline-none focus:border-amber-400 transition" required />
            <div id="nick-error" class="text-xs text-rose-400 mt-1.5 hidden"></div>
          </div>

          <button type="submit" id="btn-nick-submit" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-lg shadow-lg cursor-pointer active:scale-95 transition">
            Start Playing
          </button>
        </form>
      </div>
    `;

    this.rootEl = this.container.querySelector('#nick-root');
    this.formEl = this.container.querySelector('#nick-form');
    this.inputEl = this.container.querySelector('#nick-input');
    this.errorEl = this.container.querySelector('#nick-error');

    this.formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = this.inputEl.value.trim();
      if (val.length < 3) {
        this.showError('Nickname must be at least 3 characters');
        return;
      }

      try {
        const player = await api.identifyGuest(val);
        localStorage.setItem('blade_fruit_nickname', val);
        this.hide();
        if (this.onIdentified) this.onIdentified(player);
      } catch (err) {
        this.showError(err.message || 'Failed to enter game');
      }
    });
  }

  show() {
    this.rootEl.classList.remove('hidden');
    this.inputEl.focus();
  }

  hide() {
    this.rootEl.classList.add('hidden');
    this.errorEl.classList.add('hidden');
  }

  showError(msg) {
    this.errorEl.textContent = msg;
    this.errorEl.classList.remove('hidden');
  }
}
