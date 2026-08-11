const fs = require('fs');
const path = require('path');

function removeAndroidWebpDuplicates(resDir) {
  if (!fs.existsSync(resDir)) return;
  const entries = fs.readdirSync(resDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('mipmap-')) {
      const dirPath = path.join(resDir, entry.name);
      const files = fs.readdirSync(dirPath);
      for (const f of files) {
        if (f.endsWith('.webp') && f.startsWith('ic_launcher')) {
          const webpPath = path.join(dirPath, f);
          try {
            fs.unlinkSync(webpPath);
            console.log(`Deleted conflicting webp icon -> ${path.relative(__dirname, webpPath)}`);
          } catch (e) {
            console.error(`Failed to delete ${webpPath}: ${e.message}`);
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
  console.log('Cleaning up duplicate Expo prebuild .webp icons...');
  removeAndroidWebpDuplicates(androidDst);

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
