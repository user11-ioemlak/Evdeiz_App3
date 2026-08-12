const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

function getClient(url) {
  return url.startsWith('https') ? https : http;
}

function getDynamicConfigUrl() {
  const appJsonPath = path.join(__dirname, 'app.json');
  let buildUrl = 'https://ioemlak.com/';
  if (fs.existsSync(appJsonPath)) {
    try {
      const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      if (appConfig.expo?.extra?.buildUrl) {
        buildUrl = appConfig.expo.extra.buildUrl;
      }
    } catch {}
  }
  const cleanBaseUrl = buildUrl.endsWith('/') ? buildUrl.slice(0, -1) : buildUrl;
  return `${cleanBaseUrl}/app_icon/config.json`;
}

// HTTP/HTTPS GET Helper (Promise)
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = getClient(url);
    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// File Download Helper (Promise)
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const file = fs.createWriteStream(destPath);
    const client = getClient(url);
    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      file.close();
      try { fs.unlinkSync(destPath); } catch {}
      reject(err);
    });
  });
}

function removeExpoDefaultIcons(resDir) {
  if (!fs.existsSync(resDir)) return;

  const anydpiDir = path.join(resDir, 'mipmap-anydpi-v26');
  if (fs.existsSync(anydpiDir)) {
    fs.rmSync(anydpiDir, { recursive: true, force: true });
    console.log(`Deleted adaptive icon dir -> ${path.relative(__dirname, anydpiDir)}`);
  }

  const conflictPatterns = [
    /^ic_launcher.*\.webp$/,
    /^ic_launcher_foreground\.\w+$/,
    /^ic_launcher_background\.\w+$/,
    /^ic_launcher_monochrome\.\w+$/,
  ];

  const entries = fs.readdirSync(resDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('mipmap-')) {
      const dirPath = path.join(resDir, entry.name);
      const files = fs.readdirSync(dirPath);
      for (const f of files) {
        if (conflictPatterns.some(rx => rx.test(f))) {
          const filePath = path.join(dirPath, f);
          try {
            fs.unlinkSync(filePath);
            console.log(`Deleted conflicting icon -> ${path.relative(__dirname, filePath)}`);
          } catch (e) {
            console.error(`Failed to delete ${filePath}: ${e.message}`);
          }
        }
      }
    }
  }
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(dst, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
      console.log(`Copied icon -> ${path.relative(__dirname, dstPath)}`);
    }
  }
}

// Dynamic app.json Update for iOS Alternate Icons
function updateAppJsonAlternateIcons(themeNames) {
  const appJsonPath = path.join(__dirname, 'app.json');
  if (!fs.existsSync(appJsonPath)) return;

  try {
    const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    if (!appConfig.expo) return;
    if (!appConfig.expo.ios) appConfig.expo.ios = {};
    if (!appConfig.expo.ios.infoPlist) appConfig.expo.ios.infoPlist = {};

    const iphoneAlternate = {};
    const ipadAlternate = {};

    for (const theme of themeNames) {
      iphoneAlternate[theme] = {
        CFBundleIconFiles: [`${theme}60x60`],
        UIPrerenderedIcon: false,
      };
      ipadAlternate[theme] = {
        CFBundleIconFiles: [`${theme}60x60`, `${theme}76x76`],
        UIPrerenderedIcon: false,
      };
    }

    appConfig.expo.ios.infoPlist.CFBundleIcons = {
      CFBundlePrimaryIcon: {
        CFBundleIconFiles: ['AppIcon60x60'],
        UIPrerenderedIcon: false,
      },
      CFBundleAlternateIcons: iphoneAlternate,
    };

    appConfig.expo.ios.infoPlist['CFBundleIcons~ipad'] = {
      CFBundlePrimaryIcon: {
        CFBundleIconFiles: ['AppIcon60x60', 'AppIcon76x76'],
        UIPrerenderedIcon: false,
      },
      CFBundleAlternateIcons: ipadAlternate,
    };

    fs.writeFileSync(appJsonPath, JSON.stringify(appConfig, null, 2), 'utf8');
    console.log(`Successfully updated app.json with ${themeNames.length} dynamic alternate icon themes: ${themeNames.join(', ')}`);
  } catch (e) {
    console.error('Failed to update app.json dynamically:', e.message);
  }
}

async function main() {
  console.log('--- Step 0: Fetching config.json dynamically from server ---');
  const themeNames = new Set();

  try {
    const configUrl = getDynamicConfigUrl();
    console.log(`Fetching config from dynamic URL (${configUrl})...`);
    const configData = await fetchJson(configUrl);
    if (configData && Array.isArray(configData.ozel_gunler)) {
      console.log(`Found ${configData.ozel_gunler.length} special day entries in config.json`);

      for (const gun of configData.ozel_gunler) {
        // iOS Icons Download
        if (gun.ios && gun.ios.tema && Array.isArray(gun.ios.dosyalar) && gun.ios.dosyalar.length > 0) {
          const theme = gun.ios.tema;
          themeNames.add(theme);
          const iosDestDir = path.join(__dirname, 'assets', 'alternate_icons', theme, 'ios');

          for (const filename of gun.ios.dosyalar) {
            const fileUrl = gun.ios.base_url + filename;
            const filePath = path.join(iosDestDir, filename);
            try {
              await downloadFile(fileUrl, filePath);
              console.log(`[Downloaded iOS] ${theme}/${filename}`);
            } catch (err) {
              console.warn(`[Skip iOS] ${theme}/${filename}: ${err.message}`);
            }
          }
        }

        // Android Icons Download
        if (gun.android && gun.android.tema && Array.isArray(gun.android.dosyalar) && gun.android.dosyalar.length > 0) {
          const theme = gun.android.tema;
          themeNames.add(theme);
          const androidDestDir = path.join(__dirname, 'assets', 'alternate_icons', theme, 'android');

          for (const filename of gun.android.dosyalar) {
            const fileUrl = gun.android.base_url + filename;
            const filePath = path.join(androidDestDir, filename);
            try {
              await downloadFile(fileUrl, filePath);
              console.log(`[Downloaded Android] ${theme}/${filename}`);
            } catch (err) {
              console.warn(`[Skip Android] ${theme}/${filename}: ${err.message}`);
            }
          }
        }
      }

      // Automatically update app.json with all discovered themes
      if (themeNames.size > 0) {
        updateAppJsonAlternateIcons(Array.from(themeNames));
      }
    }
  } catch (err) {
    console.warn(`[Warning] Could not fetch remote config.json: ${err.message}. Using local alternate_icons fallback.`);
  }

  // 1. Copy Android Icons & clean up default Expo webp icons
  const androidSrc = path.join(__dirname, 'assets', 'android_icons');
  const androidDst = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');
  if (fs.existsSync(androidSrc)) {
    console.log('Cleaning up Expo prebuild default icons...');
    removeExpoDefaultIcons(androidDst);

    console.log('Copying Android mipmap and drawable icons...');
    copyDir(androidSrc, androidDst);
  }

  // 2. Copy Apple iOS Icons into Xcode AppIcon.appiconset
  const iosAppDir = path.join(__dirname, 'ios');
  if (fs.existsSync(iosAppDir)) {
    const appleSrc = path.join(__dirname, 'assets', 'apple_icons');

    function findAppIconSet(dir) {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const f of files) {
        const fullPath = path.join(dir, f.name);
        if (f.isDirectory()) {
          if (f.name === 'AppIcon.appiconset') return fullPath;
          const res = findAppIconSet(fullPath);
          if (res) return res;
        }
      }
      return null;
    }

    const iosTarget = findAppIconSet(iosAppDir);
    if (iosTarget && fs.existsSync(appleSrc)) {
      console.log('Copying Apple iOS icons into Xcode AppIcon.appiconset...');
      copyDir(appleSrc, iosTarget);
    }

    // 2b. Copy Alternate iOS Icon Sets
    const alternateDir = path.join(__dirname, 'assets', 'alternate_icons');
    if (fs.existsSync(alternateDir) && iosTarget) {
      const imagesXcassetsDir = path.dirname(iosTarget); // Images.xcassets
      const themes = fs.readdirSync(alternateDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      for (const theme of themes) {
        const themeSrc = path.join(alternateDir, theme, 'ios');
        if (!fs.existsSync(themeSrc)) continue;

        const srcFiles = fs.readdirSync(themeSrc).filter(f => f.endsWith('.png'));
        if (srcFiles.length === 0) continue;

        const altSetDir = path.join(imagesXcassetsDir, `${theme}.appiconset`);
        if (!fs.existsSync(altSetDir)) {
          fs.mkdirSync(altSetDir, { recursive: true });
        }

        const images = [];
        const sizeMap = {
          '20x20@2x': { size: '20x20', scale: '2x', idiom: 'iphone' },
          '20x20@3x': { size: '20x20', scale: '3x', idiom: 'iphone' },
          '29x29@2x': { size: '29x29', scale: '2x', idiom: 'iphone' },
          '29x29@3x': { size: '29x29', scale: '3x', idiom: 'iphone' },
          '40x40@2x': { size: '40x40', scale: '2x', idiom: 'iphone' },
          '40x40@3x': { size: '40x40', scale: '3x', idiom: 'iphone' },
          '60x60@2x': { size: '60x60', scale: '2x', idiom: 'iphone' },
          '60x60@3x': { size: '60x60', scale: '3x', idiom: 'iphone' },
          '76x76@1x': { size: '76x76', scale: '1x', idiom: 'ipad' },
          '76x76@2x': { size: '76x76', scale: '2x', idiom: 'ipad' },
          '83.5x83.5@2x': { size: '83.5x83.5', scale: '2x', idiom: 'ipad' },
          '1024x1024': { size: '1024x1024', scale: '1x', idiom: 'ios-marketing' },
        };

        for (const srcFile of srcFiles) {
          const match = srcFile.match(/AppIcon-(.+)\.png$/);
          if (!match) continue;
          const sizeKey = match[1];
          const meta = sizeMap[sizeKey];
          if (!meta) continue;

          const destName = `${theme}${sizeKey.replace('x', 'x')}.png`;
          fs.copyFileSync(path.join(themeSrc, srcFile), path.join(altSetDir, destName));
          images.push({
            size: meta.size,
            idiom: meta.idiom,
            filename: destName,
            scale: meta.scale,
          });
          console.log(`Copied alternate iOS icon -> ${theme}.appiconset/${destName}`);
        }

        const contentsJson = {
          images,
          info: { version: 1, author: 'evdeiz' },
        };
        fs.writeFileSync(
          path.join(altSetDir, 'Contents.json'),
          JSON.stringify(contentsJson, null, 2)
        );
        console.log(`Created Contents.json for ${theme}.appiconset`);
      }
    }
  }

  // 2c. Copy Alternate Android Icon Sets
  const alternateIconsDir = path.join(__dirname, 'assets', 'alternate_icons');
  if (fs.existsSync(alternateIconsDir) && fs.existsSync(androidDst)) {
    const themes = fs.readdirSync(alternateIconsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    const densityMap = {
      'mipmap-ldpi.png':    'mipmap-ldpi',
      'mipmap-mdpi.png':    'mipmap-mdpi',
      'mipmap-hdpi.png':    'mipmap-hdpi',
      'mipmap-xhdpi.png':   'mipmap-xhdpi',
      'mipmap-xxhdpi.png':  'mipmap-xxhdpi',
      'mipmap-xxxhdpi.png': 'mipmap-xxxhdpi',
    };

    for (const theme of themes) {
      const themeSrc = path.join(alternateIconsDir, theme, 'android');
      if (!fs.existsSync(themeSrc)) continue;

      const srcFiles = fs.readdirSync(themeSrc).filter(f => f.endsWith('.png'));
      for (const srcFile of srcFiles) {
        const densityDir = densityMap[srcFile];
        if (!densityDir) continue;

        const destDir = path.join(androidDst, densityDir);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        const destName = `ic_launcher_${theme.toLowerCase()}.png`;
        fs.copyFileSync(path.join(themeSrc, srcFile), path.join(destDir, destName));
        console.log(`Copied alternate Android icon -> ${densityDir}/${destName}`);
      }
    }
  }

  // 3. Helper for copying icons directly into compiled .app directory (for Sideloadly / IPA bundle root)
  const args = process.argv.slice(2);
  const appPathArgIndex = args.indexOf('--app-path');
  if (appPathArgIndex !== -1 && args[appPathArgIndex + 1]) {
    const appPath = args[appPathArgIndex + 1];
    if (fs.existsSync(appPath)) {
      console.log(`Copying iOS root icons directly into ${appPath}...`);
      const appleSrc = path.join(__dirname, 'assets', 'apple_icons');
      const iconMappings = [
        { src: 'AppIcon-60x60@2x.png', dst: 'AppIcon60x60@2x~iphone.png' },
        { src: 'AppIcon-60x60@3x.png', dst: 'AppIcon60x60@3x~iphone.png' },
        { src: 'AppIcon-76x76@2x.png', dst: 'AppIcon76x76@2x~ipad.png' },
        { src: 'AppIcon-76x76@1x.png', dst: 'AppIcon76x76~ipad.png' },
        { src: 'AppIcon-20x20@2x.png', dst: 'AppIcon20x20@2x~iphone.png' },
        { src: 'AppIcon-29x29@2x.png', dst: 'AppIcon29x29@2x~iphone.png' },
        { src: 'AppIcon-40x40@2x.png', dst: 'AppIcon40x40@2x~iphone.png' },
        { src: 'AppIcon-1024x1024.png', dst: 'iTunesArtwork' },
        { src: 'AppIcon-1024x1024.png', dst: 'iTunesArtwork.png' },
        { src: 'AppIcon-60x60@2x.png', dst: 'Icon.png' },
        { src: 'AppIcon-60x60@3x.png', dst: 'Icon@2x.png' },
      ];

      for (const item of iconMappings) {
        const srcFile = path.join(appleSrc, item.src);
        const dstFile = path.join(appPath, item.dst);
        if (fs.existsSync(srcFile)) {
          fs.copyFileSync(srcFile, dstFile);
          console.log(`Copied bundle root icon -> ${item.dst}`);
        }
      }
    }
  }

  console.log('App icons processed successfully!');
}

main().catch((err) => {
  console.error('Fatal error in copy-app-icons.js:', err);
  process.exit(1);
});
