const fs = require('fs');
const path = require('path');

function removeExpoDefaultIcons(resDir) {
  if (!fs.existsSync(resDir)) return;

  // 1. Delete mipmap-anydpi-v26 entirely (adaptive icon XMLs that reference
  //    foreground/background/monochrome layers we don't ship)
  const anydpiDir = path.join(resDir, 'mipmap-anydpi-v26');
  if (fs.existsSync(anydpiDir)) {
    fs.rmSync(anydpiDir, { recursive: true, force: true });
    console.log(`Deleted adaptive icon dir -> ${path.relative(__dirname, anydpiDir)}`);
  }

  // 2. Walk every mipmap-* directory and remove Expo's default files that
  //    would conflict with our custom PNGs
  const conflictPatterns = [
    /^ic_launcher.*\.webp$/,            // default webp launcher icons
    /^ic_launcher_foreground\.\w+$/,    // adaptive foreground layer
    /^ic_launcher_background\.\w+$/,    // adaptive background layer
    /^ic_launcher_monochrome\.\w+$/,    // adaptive monochrome layer
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

// 1. Copy Android Icons & clean up Expo prebuild default .webp icons
const androidSrc = path.join(__dirname, 'assets', 'android_icons');
const androidDst = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');
if (fs.existsSync(androidSrc)) {
  console.log('Cleaning up Expo prebuild default icons...');
  removeExpoDefaultIcons(androidDst);

  console.log('Copying Android mipmap and drawable icons...');
  copyDir(androidSrc, androidDst);
}

// 2. Copy Apple iOS Icons if iOS native dir exists
const iosAppDir = path.join(__dirname, 'ios');
if (fs.existsSync(iosAppDir)) {
  const appleSrc = path.join(__dirname, 'assets', 'apple_icons');
  // Find AppIcon.appiconset directory inside ios
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
    console.log('Copying Apple iOS icons...');
    copyDir(appleSrc, iosTarget);
  }
}

console.log('App icons copied successfully!');
