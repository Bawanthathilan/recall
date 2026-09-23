// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Web only: expo-sqlite runs SQLite compiled to WebAssembly in the browser,
// so Metro must be able to serve .wasm files. iOS/Android ignore this.
// (We only use expo-sqlite's async API, so the COOP/COEP headers the docs
// mention for SharedArrayBuffer — needed by the *sync* API — aren't required.)
config.resolver.assetExts.push('wasm');

module.exports = config;
