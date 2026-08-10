const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const appJsonPath = path.join(__dirname, 'app.json');
const packageJsonPath = path.join(__dirname, 'package.json');

function readConfig() {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return { appJson, packageJson };
}

function cleanRepoInput(rawRepo) {
  if (!rawRepo) return null;
  let repo = rawRepo.trim();
  repo = repo.replace(/^(https?:\/\/github\.com\/|git@github\.com:)/i, '');
  while (repo.endsWith('/') || repo.toLowerCase().endsWith('.git')) {
    repo = repo.replace(/\/+$/, '');
    repo = repo.replace(/\.git$/i, '');
  }
  return repo;
}

function getRepoName(appJson) {
  let repo = appJson.expo?.extra?.githubRepo || '';
  if (!repo) {
    try {
      const gitRemote = execSync('git remote get-url origin', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      const match = gitRemote.match(/github\.com[:/]([^/]+\/[^/.]+?)(\.git)?\/?$/);
      if (match) {
        repo = match[1];
      }
    } catch (e) {}
  }
  if (!repo) {
    repo = 'user07-ioemlak/Prototype';
  }
  return cleanRepoInput(repo);
}

function showConfig() {
  const { appJson } = readConfig();
  const name = appJson.expo?.name || 'Bilinmiyor';
  const version = appJson.expo?.version || '1.0.0';
  const bundleId = appJson.expo?.ios?.bundleIdentifier || appJson.expo?.android?.package || 'com.prototype.app';
  const repo = getRepoName(appJson);
  const env = appJson.expo?.extra?.buildEnv || 'test';
  const activeUrl = appJson.expo?.extra?.activeUrl || 'http://192.168.0.3/';

  console.log(`MEVCUT_NAME=${name}`);
  console.log(`MEVCUT_VERSION=${version}`);
  console.log(`MEVCUT_BUNDLE_ID=${bundleId}`);
  console.log(`MEVCUT_REPO=${repo}`);
  console.log(`MEVCUT_ENV=${env}`);
  console.log(`MEVCUT_ACTIVE_URL=${activeUrl}`);
}

function showRepo() {
  const { appJson } = readConfig();
  const repo = getRepoName(appJson);
  console.log(`MEVCUT_REPO=${repo}`);
}

function showEnv() {
  const { appJson } = readConfig();
  const env = appJson.expo?.extra?.buildEnv || 'test';
  const testUrl = appJson.expo?.extra?.testUrl || 'http://192.168.0.3/';
  const liveUrl = appJson.expo?.extra?.liveUrl || 'https://evdeiz.com/';
  const activeUrl = appJson.expo?.extra?.activeUrl || (env === 'live' ? liveUrl : testUrl);

  console.log(`MEVCUT_ENV=${env}`);
  console.log(`MEVCUT_TEST_URL=${testUrl}`);
  console.log(`MEVCUT_LIVE_URL=${liveUrl}`);
  console.log(`MEVCUT_ACTIVE_URL=${activeUrl}`);
}

function updateEnv(mode, newLiveUrl, newTestUrl) {
  const { appJson, packageJson } = readConfig();
  if (!appJson.expo.extra) appJson.expo.extra = {};

  if (mode && (mode === 'test' || mode === 'live')) {
    appJson.expo.extra.buildEnv = mode;
  }

  if (newTestUrl && newTestUrl !== '-') {
    let url = newTestUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    if (!url.endsWith('/')) url += '/';
    appJson.expo.extra.testUrl = url;
  }

  if (newLiveUrl && newLiveUrl !== '-') {
    let url = newLiveUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    if (!url.endsWith('/')) url += '/';
    appJson.expo.extra.liveUrl = url;
  }

  const currentMode = appJson.expo.extra.buildEnv || 'test';
  const currentTest = appJson.expo.extra.testUrl || 'http://192.168.0.3/';
  const currentLive = appJson.expo.extra.liveUrl || 'https://evdeiz.com/';

  appJson.expo.extra.activeUrl = currentMode === 'live' ? currentLive : currentTest;

  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

  console.log('BASARILI');
}

function updateConfig(newName, newVersion, newBundleId, rawRepo) {
  const { appJson, packageJson } = readConfig();

  if (newName) {
    appJson.expo.name = newName;
    const slug = newName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (slug) {
      appJson.expo.slug = slug;
      packageJson.name = slug;
    }
    if (!appJson.expo.ios) appJson.expo.ios = {};
    if (!appJson.expo.ios.infoPlist) appJson.expo.ios.infoPlist = {};
    appJson.expo.ios.infoPlist.CFBundleDisplayName = newName;
  }

  if (newVersion) {
    appJson.expo.version = newVersion;
    packageJson.version = newVersion;
  }

  if (newBundleId) {
    if (!appJson.expo.ios) appJson.expo.ios = {};
    appJson.expo.ios.bundleIdentifier = newBundleId;
    if (!appJson.expo.android) appJson.expo.android = {};
    appJson.expo.android.package = newBundleId;
  }

  const cleanRepo = cleanRepoInput(rawRepo);
  if (cleanRepo) {
    if (!appJson.expo.extra) appJson.expo.extra = {};
    appJson.expo.extra.githubRepo = cleanRepo;

    // Check if repo exists on GitHub, create if not
    try {
      execSync(`gh repo view ${cleanRepo}`, { stdio: 'ignore' });
    } catch (err) {
      console.log(`\n[BILGI] GitHub'da '${cleanRepo}' reposu bulunamadi. Yeni private repo olusturuluyor...`);
      try {
        execSync(`gh repo create ${cleanRepo} --private`, { stdio: 'inherit' });
        console.log(`[BASARILI] GitHub reposu '${cleanRepo}' basariyla olusturuldu!`);
      } catch (createErr) {
        console.log(`[UYARI] Repository otomatik olusturulamadi: ${createErr.message}`);
      }
    }

    try {
      const repoUrl = `https://github.com/${cleanRepo}.git`;
      try {
        execSync(`git remote set-url origin ${repoUrl}`, { stdio: 'ignore' });
      } catch (e) {
        execSync(`git remote add origin ${repoUrl}`, { stdio: 'ignore' });
      }
    } catch (e2) {}
  }

  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

  console.log('BASARILI');
}

const args = process.argv.slice(2);

if (args[0] === '--get') {
  showConfig();
} else if (args[0] === '--get-repo') {
  showRepo();
} else if (args[0] === '--get-env') {
  showEnv();
} else if (args[0] === '--set-env') {
  const mode = args[1] && args[1] !== '-' ? args[1] : null;
  const newLiveUrl = args[2] && args[2] !== '-' ? args[2] : null;
  const newTestUrl = args[3] && args[3] !== '-' ? args[3] : null;
  updateEnv(mode, newLiveUrl, newTestUrl);
} else if (args[0] === '--set') {
  const newName = args[1] && args[1] !== '-' ? args[1] : null;
  const newVersion = args[2] && args[2] !== '-' ? args[2] : null;
  const newBundleId = args[3] && args[3] !== '-' ? args[3] : null;
  const newRepo = args[4] && args[4] !== '-' ? args[4] : null;
  updateConfig(newName, newVersion, newBundleId, newRepo);
} else {
  showConfig();
}


