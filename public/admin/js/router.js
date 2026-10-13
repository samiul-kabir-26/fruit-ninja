/**
 * Admin Hash Router & View Dispatcher.
 */

import { adminApi } from './api.js';
import { renderLogin } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderTheme } from './views/theme.js';
import { renderSettings } from './views/settings.js';
import { renderEvents } from './views/events.js';
import { renderLeaderboard } from './views/leaderboard.js';
import { renderPlayers } from './views/players.js';
import { renderWebhooks } from './views/webhooks.js';
import { renderApiKeys } from './views/apikeys.js';
import { renderAuditLog } from './views/audit.js';

const routes = {
  '#/login': renderLogin,
  '#/dashboard': renderDashboard,
  '#/theme': renderTheme,
  '#/settings': renderSettings,
  '#/events': renderEvents,
  '#/leaderboard': renderLeaderboard,
  '#/players': renderPlayers,
  '#/webhooks': renderWebhooks,
  '#/apikeys': renderApiKeys,
  '#/audit': renderAuditLog
};

export class AdminRouter {
  constructor(appContainer, sidebarEl, topbarEl) {
    this.container = appContainer;
    this.sidebar = sidebarEl;
    this.topbar = topbarEl;
    this.currentHash = '';
    this.init();
  }

  init() {
    window.addEventListener('hashchange', () => this.navigate());
    this.navigate();
  }

  async navigate() {
    let hash = window.location.hash || '#/dashboard';
    if (!routes[hash]) {
      hash = '#/dashboard';
      window.location.hash = hash;
      return;
    }

    this.currentHash = hash;

    // Check if on login route
    if (hash === '#/login') {
      this.sidebar.classList.add('hidden');
      this.topbar.classList.add('hidden');
      renderLogin(this.container);
      return;
    }

    // Auth guard for protected routes
    try {
      await adminApi.getMe();
      this.sidebar.classList.remove('hidden');
      this.topbar.classList.remove('hidden');
      this.updateActiveNavLink(hash);
      const renderFn = routes[hash];
      renderFn(this.container);
    } catch {
      window.location.hash = '#/login';
    }
  }

  updateActiveNavLink(hash) {
    document.querySelectorAll('.admin-nav-item').forEach(link => {
      if (link.getAttribute('href') === hash) {
        link.className = 'admin-nav-item flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs bg-amber-500/15 text-amber-300 border border-amber-500/30 transition';
      } else {
        link.className = 'admin-nav-item flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs text-slate-400 hover:text-white hover:bg-white/5 transition';
      }
    });
  }
}
