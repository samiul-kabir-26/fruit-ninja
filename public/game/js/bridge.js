/**
 * PostMessage Bridge for Host Embedding Contract.
 */

export class HostBridge {
  constructor(gameInstance) {
    this.game = gameInstance;
    this.init();
  }

  init() {
    window.addEventListener('message', (e) => {
      const data = e.data;
      if (!data || typeof data !== 'object' || !data.type) return;

      switch (data.type) {
        case 'bf:auth':
          if (data.token) {
            this.game.authenticateWithToken(data.token);
          }
          break;
        case 'bf:start':
          if (data.mode) {
            this.game.startRound(data.mode);
          }
          break;
        case 'bf:pause':
          this.game.loop.pause();
          break;
        case 'bf:resume':
          this.game.loop.resume();
          break;
        case 'bf:mute':
          if (data.muted !== undefined) {
            if (this.game.audio.isMuted() !== data.muted) {
              this.game.audio.toggleMute();
            }
          }
          break;
      }
    });

    // Notify host that game is loaded and ready
    this.postMessage('bf:ready', { version: 1 });
  }

  postMessage(type, payload = {}) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type, ...payload }, '*');
    }
  }

  notifySessionStarted(sessionId, mode) {
    this.postMessage('bf:session-started', { sessionId, mode });
  }

  notifySessionEnded(sessionId, mode, finalScore, accepted, rank) {
    this.postMessage('bf:session-ended', { sessionId, mode, finalScore, accepted, rank });
  }

  notifyAuthRequired() {
    this.postMessage('bf:auth-required', {});
  }
}
