/**
 * Pause Menu Overlay.
 */

export class PauseMenu {
  constructor(containerEl, { onResume, onRestart, onQuit }) {
    this.container = containerEl;
    this.onResume = onResume;
    this.onRestart = onRestart;
    this.onQuit = onQuit;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div id="pause-root" class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 select-none z-30 hidden">
        <div class="flex flex-col items-center gap-6 max-w-sm w-full bg-slate-900/90 border border-white/10 p-8 rounded-2xl shadow-2xl">
          <h2 class="text-4xl font-black italic tracking-tight text-white drop-shadow">GAME PAUSED</h2>

          <div class="flex flex-col gap-3 w-full">
            <button id="btn-pause-resume" class="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-lg shadow-lg cursor-pointer active:scale-95 transition">
              Resume (Esc)
            </button>
            <button id="btn-pause-restart" class="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-white/10 cursor-pointer active:scale-95 transition">
              Restart Round
            </button>
            <button id="btn-pause-quit" class="w-full py-3 rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white font-bold cursor-pointer active:scale-95 transition">
              Quit to Menu
            </button>
          </div>
        </div>
      </div>
    `;

    this.rootEl = this.container.querySelector('#pause-root');
    this.container.querySelector('#btn-pause-resume').addEventListener('click', () => this.onResume && this.onResume());
    this.container.querySelector('#btn-pause-restart').addEventListener('click', () => this.onRestart && this.onRestart());
    this.container.querySelector('#btn-pause-quit').addEventListener('click', () => this.onQuit && this.onQuit());
  }

  show() {
    this.rootEl.classList.remove('hidden');
  }

  hide() {
    this.rootEl.classList.add('hidden');
  }
}
