module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    // Some Solana dependencies still publish private class fields. Transform
    // them for the Hermes compiler bundled with this Expo/RN release.
    plugins: [
      ["@babel/plugin-transform-class-properties", { loose: false }],
      ["@babel/plugin-transform-private-methods", { loose: false }],
      ["@babel/plugin-transform-private-property-in-object", { loose: false }],
      "react-native-worklets/plugin"
    ]
  };
};
