const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
// Hermes in the currently pinned Expo 54 toolchain cannot bytecode-compile
// React Native's private DOM fields unless Metro emits the default profile.
config.transformer.unstable_transformProfile = "default";

// Privy documents these resolver exceptions for dependencies whose published
// package exports are not React Native-compatible yet.
const resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "isows" || moduleName.startsWith("zustand")) {
    return context.resolveRequest({ ...context, unstable_enablePackageExports: false }, moduleName, platform);
  }
  if (moduleName === "jose") {
    return context.resolveRequest({ ...context, unstable_conditionNames: ["browser"] }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.resolveRequest = resolveRequest;
module.exports = withNativeWind(config, {
  input: "./global.css",
  configPath: `${__dirname}/tailwind.config.js`
});
