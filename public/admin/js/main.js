/**
 * Admin Panel Entrypoint.
 */

import { AdminRouter } from './router.js';
import { adminApi } from './api.js';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('admin-view-container');
  const sidebar = document.getElementById('admin-sidebar');
  const topbar = document.getElementById('admin-topbar');
  const btnLogout = document.getElementById('btn-admin-logout');

  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await adminApi.logout();
    });
  }

  // Mobile menu toggle
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  if (btnToggleSidebar && sidebar) {
    btnToggleSidebar.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
    });
  }

  new AdminRouter(container, sidebar, topbar);
});
