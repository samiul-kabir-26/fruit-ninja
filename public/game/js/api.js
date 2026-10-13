/**
 * Client API Wrapper for Blade Fruit Game Service.
 * Manages player authentication, session lifecycle, and resilient event batching.
 */

class GameApiClient {
  constructor() {
    this.player = null;
    this.sessionToken = null;
    this.currentSessionId = null;
    this.eventBuffer = [];
    this.nextClientSeq = 1;
    this.flushTimer = null;
    this.isFlushing = false;

    this.initPageHideFlush();
  }

  setPlayerSession(token, player) {
    this.sessionToken = token;
    this.player = player;
  }

  async identifyWithToken(token) {
    const res = await fetch('/api/v1/players/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    if (!res.ok) throw new Error('Host token identification failed');
    const data = await res.json();
    this.setPlayerSession(data.playerSession, data.player);
    return data.player;
  }

  async identifyGuest(nickname) {
    const res = await fetch('/api/v1/players/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || 'Guest registration failed');
    }
    const data = await res.json();
    this.setPlayerSession(data.playerSession, data.player);
    return data.player;
  }

  async fetchConfig() {
    const res = await fetch('/api/v1/config');
    return res.json();
  }

  async fetchTheme(status = 'published') {
    const url = status === 'draft' ? '/api/v1/admin/theme?status=draft' : '/api/v1/theme';
    const res = await fetch(url);
    return res.json();
  }

  async fetchLeaderboard(mode, period = 'all', verifiedOnly = false) {
    const playerId = this.player?.id ? `&playerId=${this.player.id}` : '';
    const res = await fetch(`/api/v1/leaderboard?mode=${mode}&period=${period}&verifiedOnly=${verifiedOnly}${playerId}`);
    return res.json();
  }

  async startSession(mode) {
    if (!this.sessionToken) throw new Error('Not authenticated');

    const res = await fetch('/api/v1/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.sessionToken}`
      },
      body: JSON.stringify({ mode })
    });

    if (!res.ok) throw new Error('Failed to start session');
    const data = await res.json();

    this.currentSessionId = data.sessionId;
    this.eventBuffer = [];
    this.nextClientSeq = 1;
    this.startPeriodicFlush();

    return data;
  }

  bufferEvent(type, data = {}, timestampMs = 0) {
    if (!this.currentSessionId) return;

    const event = {
      seq: this.nextClientSeq++,
      t: Math.max(0, Math.round(timestampMs)),
      type,
      data
    };

    this.eventBuffer.push(event);

    if (this.eventBuffer.length >= 50) {
      this.flushEvents();
    }
  }

  startPeriodicFlush() {
    this.stopPeriodicFlush();
    this.flushTimer = setInterval(() => {
      this.flushEvents();
    }, 2000);
  }

  stopPeriodicFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  async flushEvents() {
    if (this.isFlushing || this.eventBuffer.length === 0 || !this.currentSessionId || !this.sessionToken) {
      return;
    }

    this.isFlushing = true;
    const batch = [...this.eventBuffer];

    try {
      const res = await fetch(`/api/v1/sessions/${this.currentSessionId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.sessionToken}`
        },
        body: JSON.stringify({ events: batch })
      });

      if (res.ok) {
        // Remove successfully flushed events
        const maxSeq = batch[batch.length - 1].seq;
        this.eventBuffer = this.eventBuffer.filter(e => e.seq > maxSeq);
      }
    } catch {
      // Retained in buffer to retry
    } finally {
      this.isFlushing = false;
    }
  }

  initPageHideFlush() {
    window.addEventListener('pagehide', () => {
      if (this.eventBuffer.length > 0 && this.currentSessionId && this.sessionToken) {
        fetch(`/api/v1/sessions/${this.currentSessionId}/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.sessionToken}`
          },
          body: JSON.stringify({ events: this.eventBuffer }),
          keepalive: true
        });
      }
    });
  }

  async endSession(reason, stats = {}, clientScore = 0) {
    this.stopPeriodicFlush();

    // Flush any remaining buffered events first
    if (this.eventBuffer.length > 0) {
      await this.flushEvents();
    }

    const lastSeq = this.nextClientSeq - 1;
    const sessionId = this.currentSessionId;

    const res = await fetch(`/api/v1/sessions/${sessionId}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.sessionToken}`
      },
      body: JSON.stringify({
        lastSeq,
        clientScore,
        reason,
        stats
      })
    });

    this.currentSessionId = null;

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Score submission failed');
    }

    return res.json();
  }
}

export const api = new GameApiClient();
