/**
 * Main Blade Fruit Game Controller & Canvas Engine.
 */

import { GameLoop } from './engine/loop.js';
import { InputManager } from './engine/input.js';
import { checkSegmentCircleIntersection, calculateSliceAngle } from './engine/collision.js';
import { audio } from './engine/audio.js';
import { assets } from './engine/assets.js';
import { ObjectPool } from './engine/pool.js';
import { api } from './api.js';

import { Fruit } from './entities/fruit.js';
import { FruitHalf } from './entities/half.js';
import { Bomb } from './entities/bomb.js';
import { SpecialBanana } from './entities/special.js';
import { Particle } from './entities/particle.js';
import { JuiceSplat } from './entities/splat.js';
import { TextPopup } from './entities/popup.js';

import { createWaveSpawner } from '/shared/spawner.js';
import { calculateComboBonus } from '/shared/scoringRules.js';

export const LOGICAL_WIDTH = 1920;
export const LOGICAL_HEIGHT = 1080;

export class BladeFruitGame {
  constructor({ canvas, hud, menu, countdown, pauseMenu, gameoverScreen, leaderboardModal, bridge }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hud = hud;
    this.menu = menu;
    this.countdown = countdown;
    this.pauseMenu = pauseMenu;
    this.gameoverScreen = gameoverScreen;
    this.leaderboardModal = leaderboardModal;
    this.bridge = bridge;

    this.state = 'MENU'; // MENU, COUNTDOWN, PLAYING, GAMEOVER
    this.mode = 'classic';
    this.config = {};
    this.theme = {};

    // Entity collections
    this.fruits = [];
    this.halves = [];
    this.bombs = [];
    this.specials = [];
    this.splats = [];

    // Pools
    this.particlePool = new ObjectPool(() => new Particle(), 100, 400);
    this.activeParticles = [];

    this.splatPool = new ObjectPool(() => new JuiceSplat(), 30, 30);
    this.popupPool = new ObjectPool(() => new TextPopup(), 20, 50);
    this.activePopups = [];

    // Gameplay state
    this.score = 0;
    this.bestScore = 0;
    this.lives = 3;
    this.nextLifeRecoveryScore = 100;
    this.roundTimeLeft = 60;
    this.activeSpecials = {}; // freeze: duration, frenzy: duration, double: duration
    this.freezeMultiplier = 1.0;
    this.gravity = 1400;
    this.minBladeSpeed = 900;
    this.spawner = null;
    this.sessionStartTime = 0;
    this.elapsedRoundMs = 0;

    // Swipe combo tracking: swipeId -> array of fruits sliced
    this.swipeSlices = new Map();
    this.swipeEndTimers = new Map();

    // Stats
    this.stats = {
      sliced: 0,
      missed: 0,
      bombsHit: 0,
      bestCombo: 0,
      durationMs: 0
    };

    // Quality settings
    this.lowQuality = false;

    // Menu sliceable targets
    this.menuTargets = [];

    this.initCanvasSize();
    this.initInput();
    this.initLoop();
    this.initKeyboard();
  }

  initCanvasSize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = LOGICAL_WIDTH * dpr;
    this.canvas.height = LOGICAL_HEIGHT * dpr;
    this.ctx.scale(dpr, dpr);
  }

  initInput() {
    this.input = new InputManager(
      this.canvas,
      LOGICAL_WIDTH,
      LOGICAL_HEIGHT,
      (segment, swipeId) => this.handleSwipeSegment(segment, swipeId)
    );
  }

  initLoop() {
    this.loop = new GameLoop({
      updateFn: (dtMs) => this.update(dtMs),
      renderFn: (alpha) => this.render(alpha),
      onAutoQualityDowngrade: () => {
        this.lowQuality = true;
      },
      onPauseStateChange: (paused) => {
        if (this.state === 'PLAYING') {
          if (paused) {
            this.pauseMenu.show();
          } else {
            this.pauseMenu.hide();
          }
        }
      }
    });
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (this.state === 'PLAYING') {
          if (this.loop.paused) {
            this.loop.resume();
          } else {
            this.loop.pause();
          }
        }
      } else if (e.key === 'm' || e.key === 'M') {
        const isMuted = audio.toggleMute();
        this.hud.updateMuteIcon(isMuted);
        this.menu.updateMuteIcon(isMuted);
      }
    });
  }

  async setConfigAndTheme(config, theme) {
    this.config = config;
    this.theme = theme;
    this.gravity = config.physics?.gravity || 1400;
    this.minBladeSpeed = config.physics?.minBladeSpeed || 900;
    await assets.loadTheme(theme);
    this.setupMenuTargets();
  }

  setupMenuTargets() {
    this.menuTargets = [
      {
        id: 'classic',
        mode: 'classic',
        key: 'fruit.watermelon',
        label: 'CLASSIC',
        x: LOGICAL_WIDTH * 0.28,
        y: LOGICAL_HEIGHT * 0.48,
        radius: 65,
        rotation: 0
      },
      {
        id: 'arcade',
        mode: 'arcade',
        key: 'fruit.banana',
        label: 'ARCADE',
        x: LOGICAL_WIDTH * 0.50,
        y: LOGICAL_HEIGHT * 0.45,
        radius: 65,
        rotation: 0.3
      },
      {
        id: 'zen',
        mode: 'zen',
        key: 'fruit.apple',
        label: 'ZEN',
        x: LOGICAL_WIDTH * 0.72,
        y: LOGICAL_HEIGHT * 0.48,
        radius: 65,
        rotation: -0.2
      }
    ];
  }

  start() {
    this.loop.start();
    this.showMenu();
  }

  showMenu() {
    this.state = 'MENU';
    this.clearEntities();
    this.hud.hide();
    this.gameoverScreen.hide();
    this.pauseMenu.hide();
    this.menu.show();
    this.setupMenuTargets();
  }

  clearEntities() {
    this.fruits = [];
    this.halves = [];
    this.bombs = [];
    this.specials = [];
    this.activeParticles = [];
    this.activePopups = [];
    this.splats = [];
  }

  async startRound(mode) {
    audio.ensureUnlocked();
    this.mode = mode;
    this.menu.hide();
    this.gameoverScreen.hide();
    this.pauseMenu.hide();
    this.clearEntities();

    // Start API session
    try {
      const sessionData = await api.startSession(mode);
      this.spawner = createWaveSpawner(sessionData.seed, mode, this.config, this.theme.objects);
      this.bridge.notifySessionStarted(sessionData.sessionId, mode);
    } catch {
      // Offline fallback spawner
      this.spawner = createWaveSpawner(Date.now(), mode, this.config, this.theme.objects);
    }

    this.score = 0;
    this.lives = this.config.modes?.classic?.lives || 3;
    this.nextLifeRecoveryScore = this.config.modes?.classic?.lifeRecoveryEvery || 100;
    this.activeSpecials = {};
    this.freezeMultiplier = 1.0;
    this.elapsedRoundMs = 0;
    this.sessionStartTime = performance.now();

    if (mode === 'arcade') {
      this.roundTimeLeft = this.config.modes?.arcade?.durationSec || 60;
    } else if (mode === 'zen') {
      this.roundTimeLeft = this.config.modes?.zen?.durationSec || 90;
    }

    this.stats = {
      sliced: 0,
      missed: 0,
      bombsHit: 0,
      bestCombo: 0,
      durationMs: 0
    };

    this.hud.setMode(mode);
    this.hud.updateScore(0, this.bestScore);
    this.hud.updateStrikes(this.lives);
    this.hud.updateTimer(this.roundTimeLeft);
    this.hud.show();

    this.state = 'COUNTDOWN';
    this.countdown.start(() => {
      this.state = 'PLAYING';
      this.elapsedRoundMs = 0;
      this.sessionStartTime = performance.now();
    });
  }

  handleSwipeSegment(segment, swipeId) {
    const { x1, y1, x2, y2, speed } = segment;
    if (speed < this.minBladeSpeed) return;

    audio.ensureUnlocked();

    // 1. Menu slice-to-select
    if (this.state === 'MENU') {
      for (const target of this.menuTargets) {
        if (checkSegmentCircleIntersection(x1, y1, x2, y2, target.x, target.y, target.radius)) {
          audio.playSlice();
          audio.playSplat();
          this.createSliceParticles(target.x, target.y, '#f59e0b');
          this.startRound(target.mode);
          return;
        }
      }
      return;
    }

    if (this.state !== 'PLAYING') return;

    const cutAngle = calculateSliceAngle(x1, y1, x2, y2);
    const nowMs = performance.now() - this.sessionStartTime;

    // 2. Check Fruit collisions
    for (const fruit of this.fruits) {
      if (!fruit.active || fruit.sliced) continue;

      if (checkSegmentCircleIntersection(x1, y1, x2, y2, fruit.x, fruit.y, fruit.radius)) {
        this.sliceFruit(fruit, cutAngle, swipeId, nowMs);
      }
    }

    // 3. Check Specials collisions (Arcade)
    for (const special of this.specials) {
      if (!special.active || special.sliced) continue;

      if (checkSegmentCircleIntersection(x1, y1, x2, y2, special.x, special.y, special.radius)) {
        this.sliceSpecial(special, cutAngle, swipeId, nowMs);
      }
    }

    // 4. Check Bomb collisions
    for (const bomb of this.bombs) {
      if (!bomb.active || bomb.sliced) continue;

      if (checkSegmentCircleIntersection(x1, y1, x2, y2, bomb.x, bomb.y, bomb.radius)) {
        this.sliceBomb(bomb, nowMs);
      }
    }
  }

  sliceFruit(fruit, cutAngle, swipeId, nowMs) {
    fruit.sliced = true;
    fruit.active = false;
    this.stats.sliced++;

    audio.playSlice();
    audio.playSplat();

    // Spawn halves
    const halfLeft = new FruitHalf(fruit, 'left', cutAngle);
    const halfRight = new FruitHalf(fruit, 'right', cutAngle);
    this.halves.push(halfLeft, halfRight);

    // Particles & Splat
    this.createSliceParticles(fruit.x, fruit.y, fruit.juiceColor);
    this.createJuiceSplat(fruit.x, fruit.y, fruit.juiceColor);

    // Critical check (Arcade)
    let isCritical = false;
    const isDouble = Boolean(this.activeSpecials.double);
    const mult = isDouble ? 2 : 1;
    let slicePoints = fruit.points * mult;

    if (this.mode === 'arcade' && Math.random() < (this.config.modes?.arcade?.criticalChance || 0.02)) {
      isCritical = true;
      slicePoints += 10 * mult;
      this.createPopup(fruit.x, fruit.y, 'CRITICAL! +10', '#38bdf8', '#0369a1');
    } else {
      this.createPopup(fruit.x, fruit.y, `+${slicePoints}`, '#facc15', '#854d0e');
    }

    this.addScore(slicePoints);

    // Buffer fruit.sliced event
    api.bufferEvent('fruit.sliced', {
      objectId: fruit.objectId,
      objectKey: fruit.key,
      swipeId,
      points: fruit.points,
      critical: isCritical,
      multiplier: mult
    }, nowMs);

    // Track combo for this swipe
    if (!this.swipeSlices.has(swipeId)) {
      this.swipeSlices.set(swipeId, []);
    }
    const currentSwipeList = this.swipeSlices.get(swipeId);
    currentSwipeList.push(fruit);

    // Debounce combo completion (150ms after last slice in swipe)
    if (this.swipeEndTimers.has(swipeId)) {
      clearTimeout(this.swipeEndTimers.get(swipeId));
    }

    this.swipeEndTimers.set(swipeId, setTimeout(() => {
      this.checkAndAwardCombo(swipeId, fruit.x, fruit.y, nowMs);
    }, 150));
  }

  checkAndAwardCombo(swipeId, popupX, popupY, nowMs) {
    const list = this.swipeSlices.get(swipeId) || [];
    const count = list.length;
    this.swipeSlices.delete(swipeId);
    this.swipeEndTimers.delete(swipeId);

    const minCombo = this.config.scoring?.comboMin || 3;
    if (count >= minCombo) {
      if (count > this.stats.bestCombo) {
        this.stats.bestCombo = count;
      }

      const isDouble = Boolean(this.activeSpecials.double);
      const mult = isDouble ? 2 : 1;
      const bonus = calculateComboBonus(count, this.config.scoring) * mult;

      audio.playCombo(count);
      this.addScore(bonus);
      this.createPopup(popupX, popupY, `${count} FRUIT COMBO +${bonus}`, '#ec4899', '#831843');

      api.bufferEvent('combo.achieved', {
        swipeId,
        count,
        bonus,
        objectIds: list.map(f => f.objectId)
      }, nowMs);
    }
  }

  sliceSpecial(special, cutAngle, swipeId, nowMs) {
    special.sliced = true;
    special.active = false;
    audio.playSlice();
    audio.playCombo(4);

    this.createSliceParticles(special.x, special.y, special.juiceColor);
    this.createJuiceSplat(special.x, special.y, special.juiceColor);

    const type = special.specialType;
    let duration = 5000;
    if (type === 'double') duration = 7000;

    this.activeSpecials[type] = duration / 1000;
    this.createPopup(special.x, special.y, `${type.toUpperCase()}!`, special.juiceColor, '#000000');

    api.bufferEvent('special.activated', {
      objectId: special.objectId,
      special: type,
      durationMs: duration
    }, nowMs);
  }

  sliceBomb(bomb, nowMs) {
    bomb.sliced = true;
    bomb.active = false;
    this.stats.bombsHit++;

    audio.playExplosion();

    if (this.mode === 'classic') {
      // Classic bomb ends game
      this.canvas.classList.add('screen-shake');
      setTimeout(() => this.canvas.classList.remove('screen-shake'), 600);

      api.bufferEvent('bomb.hit', {
        objectId: bomb.objectId,
        endsGame: true
      }, nowMs);

      this.endGame('bomb');
    } else if (this.mode === 'arcade') {
      // Arcade bomb deducts 10 points
      this.hud.triggerFlash();
      const penalty = this.config.modes?.arcade?.bombPenalty || 10;
      this.score = Math.max(0, this.score - penalty);
      this.hud.updateScore(this.score, this.bestScore);
      this.createPopup(bomb.x, bomb.y, `-${penalty}`, '#f43f5e', '#881337');

      api.bufferEvent('bomb.hit', {
        objectId: bomb.objectId,
        penalty,
        endsGame: false
      }, nowMs);
    }
  }

  addScore(pts) {
    this.score += pts;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
    }
    this.hud.updateScore(this.score, this.bestScore);

    // Classic life recovery every 100 points
    if (this.mode === 'classic' && this.nextLifeRecoveryScore > 0) {
      if (this.score >= this.nextLifeRecoveryScore) {
        if (this.lives < 3) {
          this.lives++;
          this.hud.updateStrikes(this.lives);
          audio.playCombo(5);
          this.createPopup(LOGICAL_WIDTH * 0.5, LOGICAL_HEIGHT * 0.3, '+1 LIFE!', '#10b981', '#064e3b');

          const nowMs = performance.now() - this.sessionStartTime;
          api.bufferEvent('life.gained', {
            livesRemaining: this.lives,
            atScore: this.nextLifeRecoveryScore
          }, nowMs);
        }
        this.nextLifeRecoveryScore += (this.config.modes?.classic?.lifeRecoveryEvery || 100);
      }
    }
  }

  handleMissedFruit(fruit) {
    if (fruit.missReported) return;
    fruit.missReported = true;
    this.stats.missed++;

    const nowMs = performance.now() - this.sessionStartTime;
    api.bufferEvent('fruit.missed', {
      objectId: fruit.objectId,
      objectKey: fruit.key
    }, nowMs);

    if (this.mode === 'classic') {
      this.lives--;
      this.hud.updateStrikes(this.lives);
      audio.playSplat();

      api.bufferEvent('life.lost', {
        livesRemaining: this.lives,
        cause: 'missed'
      }, nowMs);

      if (this.lives <= 0) {
        this.endGame('strikes');
      }
    }
  }

  async endGame(reason = 'quit') {
    if (this.state === 'GAMEOVER') return;
    this.state = 'GAMEOVER';
    audio.playGameOver();

    const durationMs = Math.round(performance.now() - this.sessionStartTime);
    this.stats.durationMs = durationMs;

    this.hud.hide();

    let result = {
      finalScore: this.score,
      personalBest: Math.max(this.score, this.bestScore),
      reason,
      stats: this.stats,
      rank: { all: null, weekly: null }
    };

    try {
      const serverResult = await api.endSession(reason, this.stats, this.score);
      result = {
        ...result,
        finalScore: serverResult.finalScore,
        personalBest: serverResult.personalBest,
        rank: serverResult.rank
      };
      this.bestScore = serverResult.personalBest;
      this.bridge.notifySessionEnded(api.currentSessionId, this.mode, serverResult.finalScore, true, serverResult.rank);
    } catch {
      // offline result
      this.bridge.notifySessionEnded(null, this.mode, this.score, false, {});
    }

    this.gameoverScreen.show(result);
  }

  createSliceParticles(x, y, color) {
    const count = this.lowQuality ? 6 : 12;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 350;
      const p = this.particlePool.obtain();
      p.init(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        color,
        3 + Math.random() * 3,
        0.02 + Math.random() * 0.02
      );
      this.activeParticles.push(p);
    }
  }

  createJuiceSplat(x, y, color) {
    if (this.splats.length >= 30) {
      const old = this.splats.shift();
      this.splatPool.release(old);
    }
    const splat = this.splatPool.obtain();
    splat.init(x, y, color);
    this.splats.push(splat);
  }

  createPopup(x, y, text, color, strokeColor) {
    const popup = this.popupPool.obtain();
    popup.init(x, y, text, color, strokeColor);
    this.activePopups.push(popup);
  }

  update(dtMs) {
    const dtSec = dtMs / 1000;
    this.input.update();

    if (this.state === 'MENU') {
      // Rotate menu floating icons slightly
      for (const t of this.menuTargets) {
        t.rotation += 0.8 * dtSec;
      }
      return;
    }

    if (this.state !== 'PLAYING') return;

    this.elapsedRoundMs += dtMs;

    // Handle Arcade Specials countdown
    let freezeActive = false;
    for (const [key, timeLeft] of Object.entries(this.activeSpecials)) {
      if (timeLeft > 0) {
        const nextTime = Math.max(0, timeLeft - dtSec);
        if (nextTime === 0) {
          delete this.activeSpecials[key];
        } else {
          this.activeSpecials[key] = nextTime;
          if (key === 'freeze') freezeActive = true;
        }
      }
    }
    this.freezeMultiplier = freezeActive ? 0.4 : 1.0;
    this.hud.updateSpecials(this.activeSpecials);

    // Timer countdown (paused during Freeze in Arcade)
    if (this.mode === 'arcade' || this.mode === 'zen') {
      if (!freezeActive) {
        this.roundTimeLeft -= dtSec;
        this.hud.updateTimer(this.roundTimeLeft);
        if (this.roundTimeLeft <= 0) {
          this.endGame('timer');
          return;
        }
      }
    }

    // Spawn Waves
    if (this.spawner && this.state === 'PLAYING') {
      const scaledElapsedMs = this.elapsedRoundMs * this.freezeMultiplier;
      if (this.spawner.getNextWaveTime() <= scaledElapsedMs) {
        const newObjects = this.spawner.spawnWave(scaledElapsedMs);
        for (const obj of newObjects) {
          if (obj.kind === 'bomb') {
            this.bombs.push(new Bomb(obj));
          } else if (obj.kind === 'special') {
            this.specials.push(new SpecialBanana(obj));
          } else {
            this.fruits.push(new Fruit(obj));
          }
        }
        audio.playThrow();
      }
    }

    const effectiveDt = dtSec * this.freezeMultiplier;

    // Update Fruits
    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const f = this.fruits[i];
      f.update(effectiveDt, this.gravity);
      if (f.isOffscreen(LOGICAL_HEIGHT)) {
        if (f.wasOnscreen && !f.sliced) {
          this.handleMissedFruit(f);
        }
        this.fruits.splice(i, 1);
      }
    }

    // Update Halves
    for (let i = this.halves.length - 1; i >= 0; i--) {
      const h = this.halves[i];
      h.update(effectiveDt, this.gravity);
      if (h.isOffscreen(LOGICAL_HEIGHT)) {
        this.halves.splice(i, 1);
      }
    }

    // Update Specials
    for (let i = this.specials.length - 1; i >= 0; i--) {
      const s = this.specials[i];
      s.update(effectiveDt, this.gravity);
      if (s.isOffscreen(LOGICAL_HEIGHT)) {
        this.specials.splice(i, 1);
      }
    }

    // Update Bombs
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.update(effectiveDt, this.gravity, (sx, sy) => {
        // Bomb fuse spark
        const spark = this.particlePool.obtain();
        spark.init(sx, sy, Math.random() * 40 - 20, Math.random() * -40 - 20, '#fbbf24', 2.5, 0.08);
        this.activeParticles.push(spark);
      });
      if (b.isOffscreen(LOGICAL_HEIGHT)) {
        this.bombs.splice(i, 1);
      }
    }

    // Update Splats
    for (let i = this.splats.length - 1; i >= 0; i--) {
      const sp = this.splats[i];
      sp.update(dtSec);
      if (!sp.active) {
        this.splatPool.release(sp);
        this.splats.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.update(dtSec);
      if (!p.active) {
        this.particlePool.release(p);
        this.activeParticles.splice(i, 1);
      }
    }

    // Update Popups
    for (let i = this.activePopups.length - 1; i >= 0; i--) {
      const pop = this.activePopups[i];
      pop.update(dtSec);
      if (!pop.active) {
        this.popupPool.release(pop);
        this.activePopups.splice(i, 1);
      }
    }
  }

  render() {
    this.ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // 1. Background
    const bgImg = assets.getImage('ui.background');
    if (bgImg) {
      this.ctx.drawImage(bgImg, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    } else {
      this.ctx.fillStyle = '#1e1108';
      this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }

    // 2. Splats on wall
    for (const splat of this.splats) {
      splat.render(this.ctx);
    }

    // 3. Menu targets (if in MENU state)
    if (this.state === 'MENU') {
      for (const t of this.menuTargets) {
        this.ctx.save();
        this.ctx.translate(t.x, t.y);
        this.ctx.rotate(t.rotation);
        const img = assets.getImage(t.key);
        if (img) {
          this.ctx.drawImage(img, -t.radius, -t.radius, t.radius * 2, t.radius * 2);
        } else {
          this.ctx.fillStyle = '#f59e0b';
          this.ctx.beginPath();
          this.ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
          this.ctx.fill();
        }
        this.ctx.restore();

        // Label underneath
        this.ctx.font = '900 24px system-ui, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#f8fafc';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 5;
        this.ctx.strokeText(t.label, t.x, t.y + t.radius + 32);
        this.ctx.fillText(t.label, t.x, t.y + t.radius + 32);
      }
    }

    // 4. Halves
    for (const h of this.halves) {
      h.render(this.ctx, assets);
    }

    // 5. Fruits & Specials & Bombs
    for (const f of this.fruits) {
      f.render(this.ctx, assets);
    }
    for (const s of this.specials) {
      s.render(this.ctx, assets);
    }
    for (const b of this.bombs) {
      b.render(this.ctx, assets);
    }

    // 6. Particles
    for (const p of this.activeParticles) {
      p.render(this.ctx);
    }

    // 7. Blade Trails
    this.input.render(this.ctx);

    // 8. Text Popups
    for (const pop of this.activePopups) {
      pop.render(this.ctx);
    }

    // 9. Frost border if freeze is active
    if (this.activeSpecials.freeze) {
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      this.ctx.lineWidth = 24;
      this.ctx.strokeRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      this.ctx.restore();
    }
  }

  // Test hook exposure
  get activeFruits() {
    return this.fruits;
  }
}
