module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  // The RN preset's default only un-ignores react-native itself; these
  // third-party libs ship untranspiled ESM too, so Jest needs to run them
  // through Babel as well instead of treating all of node_modules as opaque.
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      [
        '(jest-)?react-native',
        '@react-native(-community)?/.*',
        '@react-navigation/.*',
        'react-native-.*',
      ].join('|') +
      '))',
  ],
};
