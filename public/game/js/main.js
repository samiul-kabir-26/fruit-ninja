/**
 * Blade Fruit Game Bootstrapper.
 */

import { api } from './api.js';
import { HostBridge } from './bridge.js';
import { BladeFruitGame } from './game.js';
import { audio } from './engine/audio.js';

import { GameHUD } from './ui/hud.js';
import { MainMenu } from './ui/menu.js';
import { Countdown } from './ui/countdown.js';
import { PauseMenu } from './ui/pause.js';
import { GameOverScreen } from './ui/gameover.js';
import { LeaderboardModal } from './ui/leaderboard.js';
import { NicknameModal } from './ui/nickname.js';

async function bootstrap() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const previewMode = urlParams.get('preview'); // 'draft'
  const preselectedMode = urlParams.get('mode'); // 'classic', 'arcade', 'zen'
  const hideLeaderboard = urlParams.get('hideLeaderboard') === '1';

  // Strip token from URL immediately for security
  if (token) {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('token');
    window.history.replaceState({}, document.title, cleanUrl.toString());
  }

  const canvas = document.getElementById('game-canvas');
  const hudContainer = document.getElementById('hud-container');
  const menuContainer = document.getElementById('menu-container');
  const countdownContainer = document.getElementById('countdown-container');
  const pauseContainer = document.getElementById('pause-container');
  const gameoverContainer = document.getElementById('gameover-container');
  const leaderboardContainer = document.getElementById('leaderboard-container');
  const nicknameContainer = document.getElementById('nickname-container');

  let gameInstance = null;

  // Initialize UI components
  const hud = new GameHUD(
    hudContainer,
    () => {
      if (gameInstance?.state === 'PLAYING') {
        gameInstance.loop.pause();
      }
    },
    () => {
      const isMuted = audio.toggleMute();
      hud.updateMuteIcon(isMuted);
      menu.updateMuteIcon(isMuted);
    }
  );

  const menu = new MainMenu(
    menuContainer,
    (mode) => gameInstance?.startRound(mode),
    () => leaderboardModal.show(gameInstance?.mode || 'classic'),
    () => {
      const isMuted = audio.toggleMute();
      hud.updateMuteIcon(isMuted);
      menu.updateMuteIcon(isMuted);
    }
  );

  const countdown = new Countdown(countdownContainer);

  const pauseMenu = new PauseMenu(pauseContainer, {
    onResume: () => gameInstance?.loop.resume(),
    onRestart: () => gameInstance?.startRound(gameInstance.mode),
    onQuit: () => gameInstance?.showMenu()
  });

  const gameoverScreen = new GameOverScreen(gameoverContainer, {
    onPlayAgain: () => gameInstance?.startRound(gameInstance.mode),
    onLeaderboard: () => leaderboardModal.show(gameInstance?.mode || 'classic'),
    onMenu: () => gameInstance?.showMenu()
  });

  const leaderboardModal = new LeaderboardModal(leaderboardContainer);

  const nicknameModal = new NicknameModal(nicknameContainer, (player) => {
    menu.setPlayer(player);
    if (preselectedMode) {
      gameInstance?.startRound(preselectedMode);
    }
  });

  // Fetch initial config and theme
  const config = await api.fetchConfig();
  const theme = await api.fetchTheme(previewMode === 'draft' ? 'draft' : 'published');

  // Create game instance
  gameInstance = new BladeFruitGame({
    canvas,
    hud,
    menu,
    countdown,
    pauseMenu,
    gameoverScreen,
    leaderboardModal
  });

  // Host bridge for iframe communication
  const bridge = new HostBridge({
    loop: gameInstance.loop,
    audio,
    authenticateWithToken: async (t) => {
      try {
        const player = await api.identifyWithToken(t);
        menu.setPlayer(player);
      } catch {
        bridge.notifyAuthRequired();
      }
    },
    startRound: (m) => gameInstance.startRound(m)
  });
  gameInstance.bridge = bridge;

  await gameInstance.setConfigAndTheme(config, theme);

  // Authentication flow
  if (token) {
    try {
      const player = await api.identifyWithToken(token);
      menu.setPlayer(player);
    } catch {
      bridge.notifyAuthRequired();
    }
  } else {
    // Check guest play
    const savedNick = localStorage.getItem('blade_fruit_nickname');
    if (savedNick) {
      try {
        const player = await api.identifyGuest(savedNick);
        menu.setPlayer(player);
      } catch {
        nicknameModal.show();
      }
    } else {
      nicknameModal.show();
    }
  }

  // Hide in-game leaderboard button if requested
  if (hideLeaderboard) {
    const boardBtn = document.getElementById('btn-menu-board');
    if (boardBtn) boardBtn.style.display = 'none';
  }

  // Audio initial icon sync
  hud.updateMuteIcon(audio.isMuted());
  menu.updateMuteIcon(audio.isMuted());

  // Start game loop and show menu
  gameInstance.start();

  // If preselected mode and already authenticated
  if (preselectedMode && api.player) {
    gameInstance.startRound(preselectedMode);
  }

  // Test hook exposure
  window.__bf = {
    game: gameInstance,
    api,
    audio,
    test: {
      objects: () => gameInstance.activeFruits
    }
  };

  // Live theme reload listener for admin attract preview
  window.addEventListener('message', async (e) => {
    if (e.data?.type === 'bf:theme-updated') {
      const updatedTheme = await api.fetchTheme('draft');
      await gameInstance.setConfigAndTheme(config, updatedTheme);
    }
  });
}

window.addEventListener('DOMContentLoaded', bootstrap);
