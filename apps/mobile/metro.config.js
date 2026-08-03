const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
// Keep hierarchical lookup so packages under .pnpm (e.g. react-native → invariant) resolve.
config.resolver.disableHierarchicalLookup = false;
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
