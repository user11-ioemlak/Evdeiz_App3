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

function getCurrentGithubUser() {
  try {
    const username = execSync('gh api user --jq .login', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (username) return username;
  } catch (e) {}
  return null;
}

function getRepoName(appJson) {
  const currentGhUser = getCurrentGithubUser();
  let repo = appJson.expo?.extra?.githubRepo || '';

  if (repo && repo.includes('/')) {
    const parts = repo.split('/');
    const repoSlug = parts[1];
    if (currentGhUser && parts[0] !== currentGhUser) {
      repo = `${currentGhUser}/${repoSlug}`;
      if (!appJson.expo.extra) appJson.expo.extra = {};
      appJson.expo.extra.githubRepo = repo;
      try {
        fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
      } catch (e) {}
      try {
        const repoUrl = `https://github.com/${repo}.git`;
        try {
          execSync(`git remote set-url origin ${repoUrl}`, { stdio: 'ignore' });
        } catch (e) {
          execSync(`git remote add origin ${repoUrl}`, { stdio: 'ignore' });
        }
      } catch (e2) {}
    }
  }

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
    const user = currentGhUser || 'user07-ioemlak';
    repo = `${user}/Evdeiz_App2`;
  }

  return cleanRepoInput(repo);
}

function showConfig() {
  const { appJson } = readConfig();
  const name = appJson.expo?.name || 'Bilinmiyor';
  const version = appJson.expo?.version || '1.0.0';
  const bundleId = appJson.expo?.ios?.bundleIdentifier || appJson.expo?.android?.package || 'com.evdeiz.app';
  const repo = getRepoName(appJson);
  const repoSlug = repo.includes('/') ? repo.split('/')[1] : repo;
  const env = appJson.expo?.extra?.buildEnv || 'live';
  const buildUrl = appJson.expo?.extra?.buildUrl || '';

  console.log(`MEVCUT_NAME=${name}`);
  console.log(`MEVCUT_VERSION=${version}`);
  console.log(`MEVCUT_BUNDLE_ID=${bundleId}`);
  console.log(`MEVCUT_REPO=${repo}`);
  console.log(`MEVCUT_REPO_SLUG=${repoSlug}`);
  console.log(`MEVCUT_ENV=${env}`);
  console.log(`MEVCUT_BUILD_URL=${buildUrl}`);
}

function showRepo() {
  const { appJson } = readConfig();
  const repo = getRepoName(appJson);
  console.log(`MEVCUT_REPO=${repo}`);
}

function showEnv() {
  const { appJson } = readConfig();
  const env = appJson.expo?.extra?.buildEnv || 'live';
  const buildUrl = appJson.expo?.extra?.buildUrl || '';

  console.log(`MEVCUT_ENV=${env}`);
  console.log(`MEVCUT_BUILD_URL=${buildUrl}`);
}

function updateEnv(mode, newBuildUrl) {
  const { appJson, packageJson } = readConfig();
  if (!appJson.expo.extra) appJson.expo.extra = {};

  if (mode && (mode === 'test' || mode === 'live')) {
    appJson.expo.extra.buildEnv = mode;
  }

  if (newBuildUrl && newBuildUrl !== '-') {
    let url = newBuildUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = (appJson.expo.extra.buildEnv === 'live' ? 'https://' : 'http://') + url;
    }
    if (!url.endsWith('/')) url += '/';
    appJson.expo.extra.buildUrl = url;
  }

  // Clean up legacy URL keys if present
  delete appJson.expo.extra.activeUrl;
  delete appJson.expo.extra.testUrl;
  delete appJson.expo.extra.liveUrl;

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

  if (rawRepo && rawRepo !== '-') {
    let repoSlug = cleanRepoInput(rawRepo);
    if (repoSlug.includes('/')) {
      repoSlug = repoSlug.split('/')[1];
    }
    const currentGhUser = getCurrentGithubUser() || 'user13ioemlak';
    const fullRepo = `${currentGhUser}/${repoSlug}`;

    if (!appJson.expo.extra) appJson.expo.extra = {};
    appJson.expo.extra.githubRepo = fullRepo;

    // Check if repo exists on GitHub, create if not
    try {
      execSync(`gh repo view ${fullRepo}`, { stdio: 'ignore' });
    } catch (err) {
      console.log(`\n[BILGI] GitHub'da '${fullRepo}' reposu bulunamadi. Yeni private repo olusturuluyor...`);
      try {
        execSync(`gh repo create ${fullRepo} --private`, { stdio: 'inherit' });
        console.log(`[BASARILI] GitHub reposu '${fullRepo}' basariyla olusturuldu!`);
      } catch (createErr) {
        console.log(`[UYARI] Repository otomatik olusturulamadi: ${createErr.message}`);
      }
    }

    try {
      const repoUrl = `https://github.com/${fullRepo}.git`;
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

function showCustomConfig() {
  const { appJson } = readConfig();
  const secretToken = appJson.expo?.extra?.appSecretToken || 'Evdeiz_Secure_App_Key_2026_x87f';
  const uaPrefix = appJson.expo?.extra?.customUserAgentPrefix || 'EvdeizApp';
  const disableZoom = appJson.expo?.extra?.disableZoom !== false ? 'true' : 'false';
  const orientation = appJson.expo?.orientation || 'portrait';

  console.log(`MEVCUT_SECRET_TOKEN=${secretToken}`);
  console.log(`MEVCUT_UA_PREFIX=${uaPrefix}`);
  console.log(`MEVCUT_DISABLE_ZOOM=${disableZoom}`);
  console.log(`MEVCUT_ORIENTATION=${orientation}`);
}

function updateCustomConfig(newToken, newUaPrefix, newZoomState, newOrientation) {
  const { appJson } = readConfig();
  if (!appJson.expo.extra) appJson.expo.extra = {};

  if (newToken && newToken !== '-') {
    appJson.expo.extra.appSecretToken = newToken.trim();
  }

  if (newUaPrefix && newUaPrefix !== '-') {
    appJson.expo.extra.customUserAgentPrefix = newUaPrefix.trim();
  }

  if (newZoomState && newZoomState !== '-') {
    appJson.expo.extra.disableZoom = newZoomState.toLowerCase() === 'true';
  }

  if (newOrientation && newOrientation !== '-') {
    appJson.expo.orientation = newOrientation.trim();
  }

  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
  console.log('BASARILI');
}

const args = process.argv.slice(2);

if (args[0] === '--get') {
  showConfig();
} else if (args[0] === '--get-repo') {
  showRepo();
} else if (args[0] === '--get-env') {
  showEnv();
} else if (args[0] === '--get-custom') {
  showCustomConfig();
} else if (args[0] === '--set-custom') {
  const newToken = args[1] && args[1] !== '-' ? args[1] : null;
  const newUaPrefix = args[2] && args[2] !== '-' ? args[2] : null;
  const newZoomState = args[3] && args[3] !== '-' ? args[3] : null;
  const newOrientation = args[4] && args[4] !== '-' ? args[4] : null;
  updateCustomConfig(newToken, newUaPrefix, newZoomState, newOrientation);
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


