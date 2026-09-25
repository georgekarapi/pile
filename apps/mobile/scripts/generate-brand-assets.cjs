const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');

// Obtain sharp from pen CLI
const penPath = fs.realpathSync(execFileSync('which', ['pen'], { encoding: 'utf8' }).trim());
const sharp = createRequire(penPath)('sharp');

const mobileDir = path.resolve(__dirname, '..');
const assetsDir = path.join(mobileDir, 'assets');
const androidResDir = path.join(mobileDir, 'android/app/src/main/res');

// Core SVG Path Data
const BASE_STONE_PATH =
  'M160.92554 0.64194c15.67004-1.90652 44.96002 0.8515 60.61505 2.83447 50.13995 6.35303 105.75995 16.32001 146.255 48.83252 18.53498 14.88001 33.70996 37.38501 35.72998 61.54498 6.52997 83.23999-102.95001 99.16504-163.065 104.70502-0.78998 0.09998-1.58502 0.185-2.38 0.25-57.52002 4.98498-172.008 8.59998-217.241-30.14502-12.36652-10.59497-19.36249-24.77496-20.61051-40.96997-2.4675-32.01502 15.36899-65.17499 35.76401-88.73499 33.86398-39.11804 74.42249-54.74002 124.93247-58.31701z';

const TOP_STONE_PATH =
  'M80.0957 0.34833c5.65002-0.6745 17.09998-0.2435 22.875 0.23349 38.78998 3.20749 81.69501 15.59299 114.27503 37.182 14.84497 10.07999 32.88495 27.22199 35.81 45.9545 6.82995 43.74399-50.94001 58.18299-82.76001 63.55399-6.22004 0.89352-12.46503 1.643-18.72004 2.24902-41.26995 3.59149-95.54998-0.10251-128.48846-28.00552-13.33051-11.18601-21.591-27.27149-22.91553-44.62299-1.27649-17.79501 4.60352-35.36301 16.33402-48.80401 16.05499-18.4455 39.83499-26.18549 63.58999-27.74048z';

const SIDE_STONE_PATH =
  'M156.13231 0.33304c29.4155-3.06799 39.927 15.38751 36.94699 41.905-7.03049 62.55502-83.22949 179.30502-154.29648 167.29501-22.94951-4.32501-35.55452-22.76001-38.29552-44.95001-3.5715-28.90997 13.07201-59.77002 30.83751-81.685 28.314-34.92502 78.93201-77.0885 124.8075-82.565z';

function buildForegroundGraphic({ scale = 1.0, monochrome = false } = {}) {
  const shadow = monochrome
    ? ''
    : '<rect width="620" height="72" x="204" y="738" fill="rgba(17, 17, 16, 0.094)" rx="310" ry="36"/>';

  const stone1Color = monochrome ? '#FFFFFF' : 'rgb(17, 17, 16)';
  const stone2Color = monochrome ? '#FFFFFF' : 'rgb(23, 23, 22)';
  const stone3Color = monochrome ? '#FFFFFF' : 'rgb(36, 36, 32)';

  const inner = `
    ${shadow}
    <g id="base-stone" transform="matrix(1.50568 0 0 1.50565 337.219 461.41)">
      <path d="${BASE_STONE_PATH}" fill="${stone1Color}"/>
    </g>
    <g id="middle-stone" transform="matrix(1.50624 0 0 1.5 449.031 229.31)">
      <path d="${TOP_STONE_PATH}" fill="${stone2Color}"/>
    </g>
    <g id="side-stone" transform="matrix(1.70664 -0.457292 0.458854 1.71247 21.8203 413.83)">
      <path d="${SIDE_STONE_PATH}" fill="${stone3Color}"/>
    </g>
  `;

  if (scale === 1.0) {
    return `<g id="pile-foreground">${inner}</g>`;
  }

  return `<g id="pile-foreground" transform="translate(512, 512) scale(${scale}) translate(-517.5, -519.5)">${inner}</g>`;
}

// Master unseparated logo: has rounded corners (rx=224 ry=224)
function getFullSvg({ rx = 224 } = {}) {
  const rxAttr = rx ? ` rx="${rx}" ry="${rx}"` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <clipPath id="squircle">
      <rect width="1024" height="1024"${rxAttr}/>
    </clipPath>
  </defs>
  <g clip-path="url(#squircle)">
    <g id="background">
      <rect width="1024" height="1024" fill="#fafaf8"${rxAttr}/>
    </g>
    ${buildForegroundGraphic({ scale: 1.0 })}
  </g>
</svg>`;
}

// Standalone background layer (full bleed)
function getBackgroundSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g id="background">
    <rect width="1024" height="1024" fill="#fafaf8"/>
  </g>
</svg>`;
}

// Standalone foreground layer (transparent background)
function getForegroundSvg({ scale = 1.0, monochrome = false } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${buildForegroundGraphic({ scale, monochrome })}
</svg>`;
}

async function main() {
  console.log('Generating streamlined brand assets...');

  // 1. SVGs
  const fullSvg = getFullSvg({ rx: 224 }); // Rounded corners when not separated!
  const bgSvg = getBackgroundSvg();
  const fgSvg = getForegroundSvg({ scale: 1.0 });
  const adaptiveFgSvg = getForegroundSvg({ scale: 0.68 });

  // Save SVG copies to apps/mobile/assets
  // ponytail: single source in mobile/assets, no root duplicates
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(path.join(assetsDir, 'pile-logo.svg'), fullSvg);
  fs.writeFileSync(path.join(assetsDir, 'pile-logo-background.svg'), bgSvg);
  fs.writeFileSync(path.join(assetsDir, 'pile-logo-foreground.svg'), fgSvg);

  // 2. High-Resolution PNG Assets for Expo (Minimal & Best Practice)
  // Full App Icon (iOS and standard store asset): 1024x1024 flat icon
  await sharp(Buffer.from(fullSvg)).png().toFile(path.join(assetsDir, 'icon.png'));

  // Android Adaptive Foreground: 1024x1024 transparent, scale 0.68 (safe keyline)
  await sharp(Buffer.from(adaptiveFgSvg)).png().toFile(path.join(assetsDir, 'adaptive-icon.png'));

  // Web Favicon: 192x192
  await sharp(Buffer.from(fullSvg)).resize(192, 192).png().toFile(path.join(assetsDir, 'favicon.png'));

  // Clean up any redundant raster files from assets
  const redundantAssets = [
    path.join(assetsDir, 'adaptive-icon-background.png'),
    path.join(assetsDir, 'adaptive-icon-monochrome.png'),
    path.join(assetsDir, 'splash-icon.png'),
    path.join(assetsDir, 'pile-logo-adaptive-foreground.svg'),
    path.join(assetsDir, 'pile-logo-monochrome.svg'),
  ];
  for (const f of redundantAssets) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  console.log('✓ Streamlined Expo assets (icon.png, adaptive-icon.png, favicon.png)');

  // 3. Native Android Mipmap & Drawable Resources (Best Practice)
  const anydpiDir = path.join(androidResDir, 'mipmap-anydpi-v26');
  if (!fs.existsSync(anydpiDir)) fs.mkdirSync(anydpiDir, { recursive: true });

  const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), adaptiveIconXml);
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), adaptiveIconXml);
  console.log('✓ Written mipmap-anydpi-v26 adaptive-icon definitions');

  // Single centralized splashscreen logo in drawable/ (removes 5 redundant multi-density copies)
  const drawableDir = path.join(androidResDir, 'drawable');
  if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });
  await sharp(Buffer.from(adaptiveFgSvg)).resize(512, 512).png().toFile(path.join(drawableDir, 'splashscreen_logo.png'));

  // Android density buckets for app launcher icons:
  const densities = [
    { name: 'mdpi', iconSize: 48, fgSize: 108 },
    { name: 'hdpi', iconSize: 72, fgSize: 162 },
    { name: 'xhdpi', iconSize: 96, fgSize: 216 },
    { name: 'xxhdpi', iconSize: 144, fgSize: 324 },
    { name: 'xxxhdpi', iconSize: 192, fgSize: 432 },
  ];

  const roundIconSvg = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <clipPath id="circle-clip">
      <circle cx="512" cy="512" r="512"/>
    </clipPath>
  </defs>
  <circle cx="512" cy="512" r="512" fill="#fafaf8"/>
  <g clip-path="url(#circle-clip)">
    ${buildForegroundGraphic({ scale: 0.85 })}
  </g>
</svg>`;

  for (const d of densities) {
    const mipmapDir = path.join(androidResDir, `mipmap-${d.name}`);
    const densityDrawableDir = path.join(androidResDir, `drawable-${d.name}`);
    if (!fs.existsSync(mipmapDir)) fs.mkdirSync(mipmapDir, { recursive: true });

    // Legacy square icon
    await sharp(Buffer.from(fullSvg)).resize(d.iconSize, d.iconSize).webp({ quality: 100, lossless: true }).toFile(path.join(mipmapDir, 'ic_launcher.webp'));

    // Legacy round icon
    await sharp(Buffer.from(roundIconSvg(d.iconSize))).resize(d.iconSize, d.iconSize).webp({ quality: 100, lossless: true }).toFile(path.join(mipmapDir, 'ic_launcher_round.webp'));

    // Adaptive foreground
    await sharp(Buffer.from(adaptiveFgSvg)).resize(d.fgSize, d.fgSize).webp({ quality: 100, lossless: true }).toFile(path.join(mipmapDir, 'ic_launcher_foreground.webp'));

    // Remove legacy redundant splashscreen copies from individual density folders
    const redundantSplash = path.join(densityDrawableDir, 'splashscreen_logo.png');
    if (fs.existsSync(redundantSplash)) fs.unlinkSync(redundantSplash);

    // Remove monochrome webp if present
    const redundantMono = path.join(mipmapDir, 'ic_launcher_monochrome.webp');
    if (fs.existsSync(redundantMono)) fs.unlinkSync(redundantMono);
  }
  console.log('✓ Cleaned redundant splash screen images and updated launcher mipmaps');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
