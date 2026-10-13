import { adminApi } from '../api.js';

export function renderLogin(container) {
  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-slate-950 p-6 select-none">
      <div class="max-w-md w-full bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col gap-6">
        <div class="flex flex-col items-center text-center gap-2">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-3xl shadow-lg shadow-rose-950/50">
            🗡️
          </div>
          <h1 class="text-3xl font-black italic tracking-tight text-white mt-2">BLADE FRUIT</h1>
          <p class="text-xs uppercase tracking-widest text-slate-400 font-bold">Admin Control Panel</p>
        </div>

        <form id="admin-login-form" class="flex flex-col gap-4">
          <div id="login-error" class="hidden p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold"></div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Username</label>
            <input type="text" id="login-username" required placeholder="admin"
              class="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/15 text-white font-medium placeholder-slate-600 focus:outline-none focus:border-amber-400 transition" />
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Password</label>
            <input type="password" id="login-password" required placeholder="••••••••••••"
              class="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/15 text-white font-medium placeholder-slate-600 focus:outline-none focus:border-amber-400 transition" />
          </div>

          <button type="submit" id="btn-login-submit"
            class="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-black text-base shadow-lg shadow-rose-950/40 cursor-pointer active:scale-95 transition">
            Sign In
          </button>
        </form>

        <div class="text-center text-[11px] text-slate-500">
          Single administrative session managed via environment credentials.
        </div>
      </div>
    </div>
  `;

  const form = container.querySelector('#admin-login-form');
  const errorEl = container.querySelector('#login-error');
  const userIn = container.querySelector('#login-username');
  const passIn = container.querySelector('#login-password');
  const btn = container.querySelector('#btn-login-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Authenticating...';

    try {
      await adminApi.login(userIn.value.trim(), passIn.value);
      window.location.hash = '#/dashboard';
    } catch (err) {
      errorEl.textContent = err.message || 'Login failed. Check your credentials.';
      errorEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}
