const { withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SUPPORTED_THEMES = [
  '19Mayis', '23Nisan', '30Agustos', '29Ekim',
  'RamazanBayrami', 'KurbanBayrami', 'Yilbasi', '10Kasim',
  'Test', 'Ozel1', 'Ozel2', 'Ozel3', 'Ozel4', 'Ozel5'
];

module.exports = function withAndroidActivityAliases(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application[0];
    const packageName = config.android?.package || 'com.evdeiz.app';
    const projectRoot = config._internal?.projectRoot || process.cwd();

    for (const theme of SUPPORTED_THEMES) {
      const aliasName = `${packageName}.MainActivityAlias_${theme}`;
      const lowerTheme = theme.toLowerCase();

      // Check if custom alternate icon file exists on disk
      const altAssetPath = path.join(projectRoot, 'assets', 'alternate_icons', theme, 'android', 'mipmap-hdpi.png');
      const altResPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'mipmap-hdpi', `ic_launcher_${lowerTheme}.png`);
      const hasCustomIcon = fs.existsSync(altAssetPath) || fs.existsSync(altResPath);

      // If custom PNG does not exist yet, fallback to default launcher icon to prevent AAPT2 resource errors
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
