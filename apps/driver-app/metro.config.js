// Metro configuré pour le mono-repo pnpm : surveille la racine + résout les
// packages de l'espace de travail (@transpo/*) depuis leurs sources TS.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;
// pnpm installe en liens symboliques : sans cette option, Metro suit les chemins réels et
// perd la correspondance avec ce que le client lui demande.
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
