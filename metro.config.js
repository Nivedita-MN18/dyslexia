// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add SVG support
config.resolver.assetExts.push('svg'); // Add 'svg' to the list of asset extensions
config.resolver.sourceExts = config.resolver.sourceExts.filter(ext => ext !== 'svg'); // Remove 'svg' from source extensions

config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer'); // Specify the transformer

module.exports = config;