// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Effects here fetch from the API and set loading/data state: the "sync external system" case the rule allows in prose.
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
]);
