/**
 * Asset Preloader & Auto Half Clipper.
 */

export class AssetManager {
  constructor() {
    this.images = new Map();
    this.halves = new Map(); // key -> { left: Canvas, right: Canvas }
    this.theme = null;
  }

  async loadTheme(themeManifest) {
    this.theme = themeManifest;
    const promises = [];

    // Preload UI assets
    if (themeManifest.ui?.background) {
      promises.push(this.loadImage('ui.background', themeManifest.ui.background));
    }
    if (themeManifest.ui?.logo) {
      promises.push(this.loadImage('ui.logo', themeManifest.ui.logo));
    }

    // Preload Objects
    if (themeManifest.objects) {
      for (const obj of themeManifest.objects) {
        if (obj.image) {
          promises.push(this.loadObjectSprites(obj));
        }
      }
    }

    await Promise.allSettled(promises);
  }

  loadImage(key, src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.images.set(key, img);
        resolve(img);
      };
      img.onerror = () => {
        resolve(null);
      };
      img.src = src;
    });
  }

  async loadObjectSprites(obj) {
    const wholeImg = await this.loadImage(obj.key, obj.image);
    if (!wholeImg) return;

    if (obj.halfLeft && obj.halfRight) {
      await Promise.all([
        this.loadImage(`${obj.key}.halfLeft`, obj.halfLeft),
        this.loadImage(`${obj.key}.halfRight`, obj.halfRight)
      ]);
      const leftImg = this.images.get(`${obj.key}.halfLeft`);
      const rightImg = this.images.get(`${obj.key}.halfRight`);
      if (leftImg && rightImg) {
        this.halves.set(obj.key, { left: leftImg, right: rightImg });
        return;
      }
    }

    // Auto-generate clipped halves from the whole image!
    const { left, right } = this.createAutoClippedHalves(wholeImg);
    this.halves.set(obj.key, { left, right });
  }

  createAutoClippedHalves(wholeImg) {
    const w = wholeImg.width || 256;
    const h = wholeImg.height || 256;

    // Left half canvas
    const leftCanvas = document.createElement('canvas');
    leftCanvas.width = w;
    leftCanvas.height = h;
    const leftCtx = leftCanvas.getContext('2d');
    leftCtx.beginPath();
    leftCtx.rect(0, 0, w / 2, h);
    leftCtx.clip();
    leftCtx.drawImage(wholeImg, 0, 0);

    // Right half canvas
    const rightCanvas = document.createElement('canvas');
    rightCanvas.width = w;
    rightCanvas.height = h;
    const rightCtx = rightCanvas.getContext('2d');
    rightCtx.beginPath();
    rightCtx.rect(w / 2, 0, w / 2, h);
    rightCtx.clip();
    rightCtx.drawImage(wholeImg, 0, 0);

    return { left: leftCanvas, right: rightCanvas };
  }

  getImage(key) {
    return this.images.get(key) || null;
  }

  getHalves(key) {
    return this.halves.get(key) || null;
  }
}

export const assets = new AssetManager();
