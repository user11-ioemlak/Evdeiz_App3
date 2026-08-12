const { withAndroidManifest } = require('@expo/config-plugins');

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

    for (const theme of SUPPORTED_THEMES) {
      const aliasName = `${packageName}.MainActivityAlias_${theme}`;
      const iconDrawable = `@mipmap/ic_launcher_${theme.toLowerCase()}`;

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
