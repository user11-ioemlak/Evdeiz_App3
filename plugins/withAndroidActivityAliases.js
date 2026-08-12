const { withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withAndroidActivityAliases(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application[0];
    const packageName = config.android?.package || 'com.evdeiz.app';
    const projectRoot = config._internal?.projectRoot || process.cwd();

    // Dynamically discover all alternate icon theme names from assets/alternate_icons/
    const alternateDir = path.join(projectRoot, 'assets', 'alternate_icons');
    let themes = [];
    if (fs.existsSync(alternateDir)) {
      themes = fs.readdirSync(alternateDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
    }

    if (themes.length === 0) {
      console.log('[withAndroidActivityAliases] No alternate icon directories found in assets/alternate_icons.');
      return config;
    }

    console.log(`[withAndroidActivityAliases] Dynamically configuring Android activity-aliases for themes: ${themes.join(', ')}`);

    for (const theme of themes) {
      const aliasName = `${packageName}.MainActivityAlias_${theme}`;
      const lowerTheme = theme.toLowerCase();

      // Check if custom alternate icon file exists on disk
      const altAssetPath = path.join(projectRoot, 'assets', 'alternate_icons', theme, 'android', 'mipmap-hdpi.png');
      const altResPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'mipmap-hdpi', `ic_launcher_${lowerTheme}.png`);
      const hasCustomIcon = fs.existsSync(altAssetPath) || fs.existsSync(altResPath);

      // If custom PNG exists, use theme drawable; otherwise fallback to default launcher icon
      const iconDrawable = hasCustomIcon ? `@mipmap/ic_launcher_${lowerTheme}` : `@mipmap/ic_launcher`;

      if (!application['activity-alias']) {
        application['activity-alias'] = [];
      }

      const existingIndex = application['activity-alias'].findIndex(
        (alias) => alias['$'] && alias['$']['android:name'] === aliasName
      );

      const aliasElement = {
        '$': {
          'android:name': aliasName,
          'android:targetActivity': '.MainActivity',
          'android:enabled': 'false',
          'android:exported': 'true',
          'android:icon': iconDrawable,
          'android:roundIcon': iconDrawable,
          'android:label': '@string/app_name',
        },
        'intent-filter': [
          {
            action: [{ '$': { 'android:name': 'android.intent.action.MAIN' } }],
            category: [{ '$': { 'android:name': 'android.intent.category.LAUNCHER' } }],
          },
        ],
      };

      if (existingIndex !== -1) {
        application['activity-alias'][existingIndex] = aliasElement;
      } else {
        application['activity-alias'].push(aliasElement);
      }
    }

    return config;
  });
};
