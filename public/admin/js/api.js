/**
 * Admin API Client with CSRF & Error Management.
 */

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

class AdminApiClient {
  constructor() {
    this.csrfToken = null;
  }

  getCsrfToken() {
    return this.csrfToken || getCookie('bf_csrf') || '';
  }

  async request(path, options = {}) {
    const url = `/api/v1/admin${path}`;
    const headers = {
      ...(options.headers || {})
    };

    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      headers['X-CSRF-Token'] = this.getCsrfToken();
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type'] && options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      ...options,
      headers
    });

    if (res.status === 401) {
      if (window.location.hash !== '#/login') {
        window.location.hash = '#/login';
      }
      throw new Error('Session expired or unauthorized');
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.error?.message || `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = errData;
      throw err;
    }

    if (res.status === 204) return null;

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return res.json();
    }
    return res.blob();
  }

  // Auth
  async login(username, password) {
    const res = await fetch('/api/v1/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || 'Login failed');
    }
    const data = await res.json();
    this.csrfToken = data.csrfToken;
    return data;
  }

  async logout() {
    await this.request('/logout', { method: 'POST' }).catch(() => {});
    this.csrfToken = null;
    window.location.hash = '#/login';
  }

  async getMe() {
    return this.request('/me');
  }

  // Dashboard
  async getDashboard() {
    return this.request('/dashboard');
  }

  // Theme
  async getTheme(status = 'draft') {
    return this.request(`/theme?status=${status}`);
  }

  async updateThemeUi(data) {
    return this.request('/theme/ui', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async createThemeObject(data) {
    return this.request('/theme/objects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateThemeObject(key, data) {
    return this.request(`/theme/objects/${key}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async deleteThemeObject(key) {
    return this.request(`/theme/objects/${key}`, {
      method: 'DELETE'
    });
  }

  async uploadMedia(file, slot = '') {
    const formData = new FormData();
    formData.append('file', file);
    if (slot) formData.append('slot', slot);

    return this.request('/media', {
      method: 'POST',
      body: formData
    });
  }

  async resetSlot(slot) {
    return this.request(`/theme/slots/${slot}`, {
      method: 'DELETE'
    });
  }

  async publishTheme() {
    return this.request('/theme/publish', {
      method: 'POST'
    });
  }

  async resetTheme() {
    return this.request('/theme/reset', {
      method: 'POST'
    });
  }

  async exportTheme() {
    return this.request('/theme/export');
  }

  async importTheme(zipFile) {
    const formData = new FormData();
    formData.append('themeZip', zipFile);
    return this.request('/theme/import', {
      method: 'POST',
      body: formData
    });
  }

  // Settings
  async getSettings() {
    return this.request('/settings');
  }

  async updateSettings(data) {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // Events
  async getEvents(params = {}) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== null && v !== undefined && v !== '') {
        search.append(k, v);
      }
    }
    return this.request(`/events?${search.toString()}`);
  }

  async getSession(id) {
    return this.request(`/sessions/${id}`);
  }

  // Leaderboard
  async getLeaderboard(params = {}) {
    const search = new URLSearchParams(params);
    return this.request(`/leaderboard?${search.toString()}`);
  }

  async removeScore(id, reason) {
    return this.request(`/scores/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason })
    });
  }

  async resetLeaderboard(mode, period) {
    return this.request('/leaderboard/reset', {
      method: 'POST',
      body: JSON.stringify({ mode, period })
    });
  }

  // Players
  async getPlayers(query = '') {
    return this.request(`/players?q=${encodeURIComponent(query)}`);
  }

  async getPlayer(id) {
    return this.request(`/players/${id}`);
  }

  async setPlayerBanned(id, banned) {
    return this.request(`/players/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ banned })
    });
  }

  // Webhooks
  async getWebhooks() {
    return this.request('/webhooks');
  }

  async createWebhook(data) {
    return this.request('/webhooks', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateWebhook(id, data) {
    return this.request(`/webhooks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async deleteWebhook(id) {
    return this.request(`/webhooks/${id}`, {
      method: 'DELETE'
    });
  }

  async rotateWebhookSecret(id) {
    return this.request(`/webhooks/${id}/rotate-secret`, {
      method: 'POST'
    });
  }

  async testWebhook(id) {
    return this.request(`/webhooks/${id}/test`, {
      method: 'POST'
    });
  }

  async getWebhookDeliveries(id) {
    return this.request(`/webhooks/${id}/deliveries`);
  }

  async redeliverWebhook(deliveryId) {
    return this.request(`/webhooks/deliveries/${deliveryId}/redeliver`, {
      method: 'POST'
    });
  }

  // API Keys
  async getApiKeys() {
    return this.request('/api-keys');
  }

  async createApiKey(name) {
    return this.request('/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  }

  async revokeApiKey(id) {
    return this.request(`/api-keys/${id}`, {
      method: 'DELETE'
    });
  }

  // Audit Log
  async getAuditLog(limit = 100) {
    return this.request(`/audit-log?limit=${limit}`);
  }
}

export const adminApi = new AdminApiClient();
