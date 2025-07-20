module.exports = function(api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            // If you are using React Native Reanimated, uncomment this line:
            // 'react-native-reanimated/plugin',
        ],
    };
};