import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ASSETS_DIR = path.resolve('public/game/assets/default');
const SPRITES_DIR = path.join(ASSETS_DIR, 'sprites');
const UI_DIR = path.join(ASSETS_DIR, 'ui');
const AUDIO_DIR = path.join(ASSETS_DIR, 'audio');

fs.mkdirSync(SPRITES_DIR, { recursive: true });
fs.mkdirSync(UI_DIR, { recursive: true });
fs.mkdirSync(AUDIO_DIR, { recursive: true });

async function svgToWebp(svgStr, outPath, width = 256, height = 256) {
  await sharp(Buffer.from(svgStr))
    .resize(width, height)
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(outPath);
}

// 1. Apple
const appleWholeSvg = `
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="appleGrad" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#ff7b7b"/>
      <stop offset="45%" stop-color="#e61c24"/>
      <stop offset="90%" stop-color="#80060b"/>
    </radialGradient>
    <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#a3e635"/>
      <stop offset="100%" stop-color="#4d7c0f"/>
    </linearGradient>
  </defs>
  <!-- Stem -->
  <path d="M128 55 C125 35 138 20 148 15 C146 25 138 42 133 55 Z" fill="#5c3a21"/>
  <!-- Leaf -->
  <path d="M132 40 C155 25 175 40 170 55 C150 60 135 50 132 40 Z" fill="url(#leafGrad)"/>
  <!-- Body -->
  <path d="M128 75 C100 50 45 65 45 125 C45 185 85 225 128 220 C171 225 211 185 211 125 C211 65 156 50 128 75 Z" fill="url(#appleGrad)"/>
  <!-- Highlight -->
  <ellipse cx="85" cy="105" rx="20" ry="35" transform="rotate(-25 85 105)" fill="#ffffff" opacity="0.35"/>
</svg>`;

const appleHalf1Svg = `
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="appleFlesh" cx="40%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#fffbeb"/>
      <stop offset="85%" stop-color="#fef08a"/>
      <stop offset="100%" stop-color="#e61c24"/>
    </radialGradient>
  </defs>
  <path d="M128 75 C100 50 45 65 45 125 C45 185 85 225 128 220 Z" fill="url(#appleFlesh)" stroke="#b91c1c" stroke-width="4"/>
  <!-- Core & Seed -->
  <path d="M128 115 C115 115 110 128 128 140 Z" fill="#78350f"/>
  <ellipse cx="120" cy="126" rx="4" ry="7" fill="#451a03"/>
</svg>`;

const appleHalf2Svg = `
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="appleFlesh2" cx="60%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#fffbeb"/>
      <stop offset="85%" stop-color="#fef08a"/>
      <stop offset="100%" stop-color="#e61c24"/>
    </radialGradient>
  </defs>
  <path d="M128 75 C156 50 211 65 211 125 C211 185 171 225 128 220 Z" fill="url(#appleFlesh2)" stroke="#b91c1c" stroke-width="4"/>
  <ellipse cx="136" cy="126" rx="4" ry="7" fill="#451a03"/>
</svg>`;

// 2. Orange
const orangeWholeSvg = `
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="orangeGrad" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#fed7aa"/>
      <stop offset="40%" stop-color="#f97316"/>
      <stop offset="90%" stop-color="#c2410c"/>
    </radialGradient>
  </defs>
  <circle cx="128" cy="128" r="95" fill="url(#orangeGrad)"/>
  <ellipse cx="90" cy="95" rx="22" ry="32" transform="rotate(-30 90 95)" fill="#ffffff" opacity="0.25"/>
  <!-- Dimples -->
  <circle cx="140" cy="80" r="2" fill="#c2410c" opacity="0.6"/>
  <circle cx="160" cy="110" r="2.5" fill="#c2410c" opacity="0.6"/>
  <circle cx="110" cy="160" r="2" fill="#c2410c" opacity="0.6"/>
</svg>`;

const orangeHalf1Svg = `
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="orangeFlesh" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffedd5"/>
      <stop offset="60%" stop-color="#fb923c"/>
      <stop offset="92%" stop-color="#ea580c"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </radialGradient>
  </defs>
  <path d="M128 33 A95 95 0 0 0 128 223 Z" fill="url(#orangeFlesh)" stroke="#c2410c" stroke-width="6"/>
  <!-- Segments -->
  <path d="M122 65 A65 65 0 0 0 122 191 Z" fill="#f97316" opacity="0.8"/>
  <line x1="128" y1="128" x2="70" y2="80" stroke="#fff" stroke-width="2" opacity="0.7"/>
  <line x1="128" y1="128" x2="50" y2="128" stroke="#fff" stroke-width="2" opacity="0.7"/>
  <line x1="128" y1="128" x2="70" y2="176" stroke="#fff" stroke-width="2" opacity="0.7"/>
</svg>`;

const orangeHalf2Svg = `
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="orangeFlesh2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffedd5"/>
      <stop offset="60%" stop-color="#fb923c"/>
      <stop offset="92%" stop-color="#ea580c"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </radialGradient>
  </defs>
  <path d="M128 33 A95 95 0 0 1 128 223 Z" fill="url(#orangeFlesh2)" stroke="#c2410c" stroke-width="6"/>
  <path d="M134 65 A65 65 0 0 1 134 191 Z" fill="#f97316" opacity="0.8"/>
  <line x1="128" y1="128" x2="186" y2="80" stroke="#fff" stroke-width="2" opacity="0.7"/>
  <line x1="128" y1="128" x2="206" y2="128" stroke="#fff" stroke-width="2" opacity="0.7"/>
  <line x1="128" y1="128" x2="186" y2="176" stroke="#fff" stroke-width="2" opacity="0.7"/>
</svg>`;

// 3. Watermelon
const watermelonWholeSvg = `
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="melonGrad" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#86efac"/>
      <stop offset="50%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#14532d"/>
    </radialGradient>
  </defs>
  <ellipse cx="128" cy="128" rx="110" ry="98" fill="url(#melonGrad)"/>
  <!-- Stripes -->
  <path d="M60 45 Q70 128 55 205" stroke="#14532d" stroke-width="12" fill="none" opacity="0.85"/>
  <path d="M95 35 Q105 128 90 220" stroke="#14532d" stroke-width="14" fill="none" opacity="0.85"/>
  <path d="M135 32 Q140 128 132 225" stroke="#14532d" stroke-width="15" fill="none" opacity="0.85"/>
  <path d="M175 36 Q180 128 170 218" stroke="#14532d" stroke-width="14" fill="none" opacity="0.85"/>
  <path d="M210 50 Q205 128 200 200" stroke="#14532d" stroke-width="12" fill="none" opacity="0.85"/>
</svg>`;

const watermelonHalf1Svg = `
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <path d="M128 30 A98 98 0 0 0 128 226 Z" fill="#15803d" stroke="#14532d" stroke-width="4"/>
  <path d="M128 40 A88 88 0 0 0 128 216 Z" fill="#fecdd3"/>
  <path d="M128 50 A78 78 0 0 0 128 206 Z" fill="#f43f5e"/>
  <!-- Seeds -->
  <ellipse cx="95" cy="90" rx="3" ry="6" transform="rotate(-30 95 90)" fill="#1c1917"/>
  <ellipse cx="80" cy="130" rx="3" ry="6" fill="#1c1917"/>
  <ellipse cx="95" cy="170" rx="3" ry="6" transform="rotate(30 95 170)" fill="#1c1917"/>
</svg>`;

const watermelonHalf2Svg = `
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <path d="M128 30 A98 98 0 0 1 128 226 Z" fill="#15803d" stroke="#14532d" stroke-width="4"/>
  <path d="M128 40 A88 88 0 0 1 128 216 Z" fill="#fecdd3"/>
  <path d="M128 50 A78 78 0 0 1 128 206 Z" fill="#f43f5e"/>
  <ellipse cx="161" cy="90" rx="3" ry="6" transform="rotate(30 161 90)" fill="#1c1917"/>
  <ellipse cx="176" cy="130" rx="3" ry="6" fill="#1c1917"/>
  <ellipse cx="161" cy="170" rx="3" ry="6" transform="rotate(-30 161 170)" fill="#1c1917"/>
</svg>`;

// 4. Banana
const bananaWholeSvg = `
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bananaGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#facc15"/>
      <stop offset="100%" stop-color="#eab308"/>
    </linearGradient>
  </defs>
  <path d="M50 70 C75 140 145 200 215 175 C195 210 115 210 40 120 C25 95 35 75 50 70 Z" fill="url(#bananaGrad)" stroke="#a16207" stroke-width="2"/>
  <path d="M48 68 L38 60" stroke="#713f12" stroke-width="6" stroke-linecap="round"/>
  <circle cx="215" cy="175" r="4" fill="#713f12"/>
</svg>`;

const bananaHalf1Svg = `
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 70 C70 120 100 155 128 170 L128 135 C100 120 75 90 50 70 Z" fill="#facc15" stroke="#a16207" stroke-width="2"/>
  <ellipse cx="128" cy="152" rx="10" ry="18" fill="#fef9c3"/>
</svg>`;

const bananaHalf2Svg = `
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <path d="M128 170 C160 185 195 185 215 175 C195 205 160 200 128 170 Z" fill="#facc15" stroke="#a16207" stroke-width="2"/>
  <ellipse cx="128" cy="170" rx="10" ry="18" fill="#fef9c3"/>
</svg>`;

// 5. Bomb
const bombWholeSvg = `
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bombGrad" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="45%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#020617"/>
    </radialGradient>
  </defs>
  <!-- Cap & Fuse -->
  <rect x="114" y="45" width="28" height="18" rx="4" fill="#94a3b8"/>
  <path d="M128 45 C125 25 155 20 150 8" stroke="#ca8a04" stroke-width="6" fill="none" stroke-linecap="round"/>
  <!-- Spark -->
  <polygon points="150,0 154,6 161,5 156,10 159,16 153,13 148,17 150,11 144,7 151,7" fill="#ef4444"/>
  <polygon points="150,3 153,7 158,6 154,10 156,14 152,12 148,15 150,10 146,7 151,7" fill="#fbbf24"/>
  <!-- Sphere Body -->
  <circle cx="128" cy="145" r="85" fill="url(#bombGrad)"/>
  <!-- Highlight -->
  <ellipse cx="90" cy="110" rx="20" ry="30" transform="rotate(-30 90 110)" fill="#ffffff" opacity="0.25"/>
</svg>`;

// 6. Specials
const freezeSvg = `
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="freezeGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e0f2fe"/>
      <stop offset="50%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
  </defs>
  <circle cx="128" cy="128" r="95" fill="url(#freezeGrad)" opacity="0.9"/>
  <!-- Snowflake icon -->
  <path d="M128 50 L128 206 M50 128 L206 128 M73 73 L183 183 M73 183 L183 73" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
</svg>`;

const frenzySvg = `
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="frenzyGrad" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="40%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#dc2626"/>
    </radialGradient>
  </defs>
  <circle cx="128" cy="128" r="95" fill="url(#frenzyGrad)"/>
  <!-- Flame icon -->
  <path d="M128 60 C140 100 170 120 170 155 C170 185 150 205 128 205 C106 205 86 185 86 155 C86 125 110 90 128 60 Z" fill="#ffffff" opacity="0.9"/>
  <path d="M128 110 C135 130 150 145 150 165 C150 180 140 195 128 195 C116 195 106 180 106 165 C106 145 120 125 128 110 Z" fill="#facc15"/>
</svg>`;

const doubleSvg = `
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="doubleGrad" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#a16207"/>
    </radialGradient>
  </defs>
  <circle cx="128" cy="128" r="95" fill="url(#doubleGrad)"/>
  <text x="128" y="165" font-family="system-ui, sans-serif" font-size="105" font-weight="900" text-anchor="middle" fill="#ffffff" stroke="#713f12" stroke-width="4">2×</text>
</svg>`;

// 7. Background: Dojo wood plank wall (1920x1080)
const backgroundSvg = `
<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#241408"/>
      <stop offset="50%" stop-color="#3c220f"/>
      <stop offset="100%" stop-color="#190d05"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#bgGrad)"/>
  <!-- Wood horizontal planks -->
  <line x1="0" y1="180" x2="1920" y2="180" stroke="#120803" stroke-width="4" opacity="0.7"/>
  <line x1="0" y1="360" x2="1920" y2="360" stroke="#120803" stroke-width="4" opacity="0.7"/>
  <line x1="0" y1="540" x2="1920" y2="540" stroke="#120803" stroke-width="4" opacity="0.7"/>
  <line x1="0" y1="720" x2="1920" y2="720" stroke="#120803" stroke-width="4" opacity="0.7"/>
  <line x1="0" y1="900" x2="1920" y2="900" stroke="#120803" stroke-width="4" opacity="0.7"/>
  <!-- Vignette -->
  <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
    <stop offset="40%" stop-color="#000000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.6"/>
  </radialGradient>
  <rect width="1920" height="1080" fill="url(#vignette)"/>
</svg>`;

// 8. Logo
const logoSvg = `
<svg width="512" height="180" viewBox="0 0 512 180" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bladeGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#ef4444"/>
    </linearGradient>
    <linearGradient id="silverBlade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="50%" stop-color="#94a3b8"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
  </defs>
  <path d="M40 90 L472 90" stroke="url(#silverBlade)" stroke-width="6" opacity="0.7"/>
  <text x="256" y="85" font-family="system-ui, sans-serif" font-size="64" font-weight="900" font-style="italic" text-anchor="middle" fill="url(#bladeGrad)" stroke="#78350f" stroke-width="3">BLADE</text>
  <text x="256" y="145" font-family="system-ui, sans-serif" font-size="52" font-weight="900" font-style="italic" text-anchor="middle" fill="#f8fafc" stroke="#0f172a" stroke-width="3">FRUIT</text>
</svg>`;

async function main() {
  console.log('Generating default assets...');

  // Sprites
  await svgToWebp(appleWholeSvg, path.join(SPRITES_DIR, 'apple.webp'));
  await svgToWebp(appleHalf1Svg, path.join(SPRITES_DIR, 'apple_half_1.webp'));
  await svgToWebp(appleHalf2Svg, path.join(SPRITES_DIR, 'apple_half_2.webp'));

  await svgToWebp(orangeWholeSvg, path.join(SPRITES_DIR, 'orange.webp'));
  await svgToWebp(orangeHalf1Svg, path.join(SPRITES_DIR, 'orange_half_1.webp'));
  await svgToWebp(orangeHalf2Svg, path.join(SPRITES_DIR, 'orange_half_2.webp'));

  await svgToWebp(watermelonWholeSvg, path.join(SPRITES_DIR, 'watermelon.webp'));
  await svgToWebp(watermelonHalf1Svg, path.join(SPRITES_DIR, 'watermelon_half_1.webp'));
  await svgToWebp(watermelonHalf2Svg, path.join(SPRITES_DIR, 'watermelon_half_2.webp'));

  await svgToWebp(bananaWholeSvg, path.join(SPRITES_DIR, 'banana.webp'));
  await svgToWebp(bananaHalf1Svg, path.join(SPRITES_DIR, 'banana_half_1.webp'));
  await svgToWebp(bananaHalf2Svg, path.join(SPRITES_DIR, 'banana_half_2.webp'));

  // Bomb & Specials
  await svgToWebp(bombWholeSvg, path.join(SPRITES_DIR, 'bomb.webp'));
  await svgToWebp(freezeSvg, path.join(SPRITES_DIR, 'special_freeze.webp'));
  await svgToWebp(frenzySvg, path.join(SPRITES_DIR, 'special_frenzy.webp'));
  await svgToWebp(doubleSvg, path.join(SPRITES_DIR, 'special_double.webp'));

  // UI
  await svgToWebp(backgroundSvg, path.join(UI_DIR, 'wood_background.webp'), 1920, 1080);
  await svgToWebp(logoSvg, path.join(UI_DIR, 'logo.webp'), 512, 180);

  // Generate Manifest
  const manifest = {
    themeVersion: 1,
    objects: [
      {
        key: 'fruit.apple',
        kind: 'fruit',
        label: 'Apple',
        enabled: true,
        radius: 42,
        points: 1,
        spawnWeight: 10,
        juiceColor: '#e8f5a0',
        image: '/assets/default/sprites/apple.webp',
        halfLeft: '/assets/default/sprites/apple_half_1.webp',
        halfRight: '/assets/default/sprites/apple_half_2.webp'
      },
      {
        key: 'fruit.orange',
        kind: 'fruit',
        label: 'Orange',
        enabled: true,
        radius: 44,
        points: 1,
        spawnWeight: 10,
        juiceColor: '#ffa726',
        image: '/assets/default/sprites/orange.webp',
        halfLeft: '/assets/default/sprites/orange_half_1.webp',
        halfRight: '/assets/default/sprites/orange_half_2.webp'
      },
      {
        key: 'fruit.watermelon',
        kind: 'fruit',
        label: 'Watermelon',
        enabled: true,
        radius: 60,
        points: 1,
        spawnWeight: 6,
        juiceColor: '#ff4f6d',
        image: '/assets/default/sprites/watermelon.webp',
        halfLeft: '/assets/default/sprites/watermelon_half_1.webp',
        halfRight: '/assets/default/sprites/watermelon_half_2.webp'
      },
      {
        key: 'fruit.banana',
        kind: 'fruit',
        label: 'Banana',
        enabled: true,
        radius: 46,
        points: 1,
        spawnWeight: 8,
        juiceColor: '#fff59d',
        image: '/assets/default/sprites/banana.webp',
        halfLeft: '/assets/default/sprites/banana_half_1.webp',
        halfRight: '/assets/default/sprites/banana_half_2.webp'
      },
      {
        key: 'fruit.pineapple',
        kind: 'fruit',
        label: 'Pineapple',
        enabled: true,
        radius: 55,
        points: 1,
        spawnWeight: 5,
        juiceColor: '#ffe082',
        image: '/assets/default/sprites/orange.webp' // Auto-halved by engine
      },
      {
        key: 'fruit.strawberry',
        kind: 'fruit',
        label: 'Strawberry',
        enabled: true,
        radius: 32,
        points: 1,
        spawnWeight: 9,
        juiceColor: '#ff1744',
        image: '/assets/default/sprites/apple.webp'
      },
      {
        key: 'fruit.coconut',
        kind: 'fruit',
        label: 'Coconut',
        enabled: true,
        radius: 45,
        points: 1,
        spawnWeight: 5,
        juiceColor: '#f5f5f5',
        image: '/assets/default/sprites/apple.webp'
      },
      {
        key: 'fruit.kiwi',
        kind: 'fruit',
        label: 'Kiwi',
        enabled: true,
        radius: 34,
        points: 1,
        spawnWeight: 7,
        juiceColor: '#9ccc65',
        image: '/assets/default/sprites/watermelon.webp'
      },
      {
        key: 'fruit.pomegranate',
        kind: 'fruit',
        label: 'Pomegranate',
        enabled: true,
        radius: 52,
        points: 1,
        spawnWeight: 1,
        juiceColor: '#c2185b',
        image: '/assets/default/sprites/apple.webp'
      },
      {
        key: 'bomb',
        kind: 'bomb',
        label: 'Bomb',
        enabled: true,
        radius: 40,
        points: 0,
        juiceColor: '#ffffff',
        image: '/assets/default/sprites/bomb.webp'
      },
      {
        key: 'special.freeze',
        kind: 'special',
        label: 'Freeze Banana',
        enabled: true,
        radius: 44,
        points: 1,
        juiceColor: '#81d4fa',
        image: '/assets/default/sprites/special_freeze.webp'
      },
      {
        key: 'special.frenzy',
        kind: 'special',
        label: 'Frenzy Banana',
        enabled: true,
        radius: 44,
        points: 1,
        juiceColor: '#ff8a65',
        image: '/assets/default/sprites/special_frenzy.webp'
      },
      {
        key: 'special.double',
        kind: 'special',
        label: 'Double Score Banana',
        enabled: true,
        radius: 44,
        points: 1,
        juiceColor: '#ffd54f',
        image: '/assets/default/sprites/special_double.webp'
      }
    ],
    ui: {
      logo: '/assets/default/ui/logo.webp',
      background: '/assets/default/ui/wood_background.webp',
      menuBackground: '/assets/default/ui/wood_background.webp',
      bladeColor: '#ffffff',
      bladeGlow: '#7dd3fc',
      fontFamily: 'system-ui',
      primaryColor: '#f59e0b',
      title: 'Blade Fruit'
    },
    audio: {
      'sfx.slice': null,
      'sfx.splat': null,
      'sfx.combo': null,
      'sfx.bomb_fuse': null,
      'sfx.explosion': null,
      'sfx.throw': null,
      'sfx.gameover': null
    }
  };

  fs.writeFileSync(path.join(ASSETS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('✅ Default assets and manifest.json created successfully.');
}

main().catch(console.error);
