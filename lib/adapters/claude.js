const os = require("os");
const path = require("path");

function getRoot(envName, projectRoot) {
  if (envName === "user") {
    return path.join(os.homedir(), ".claude");
  }
  return path.join(projectRoot, ".claude");
}

function getHooksConfigPath(envName, projectRoot) {
  return path.join(getRoot(envName, projectRoot), "settings.json");
}

function createAdapter() {
  return {
    name: "claude",
    supportsHooks: true,
    detect() {
      return true;
    },
    getRoot,
    getHooksConfigPath,
    resolveTarget(envName, projectRoot, targetPath) {
      return path.join(getRoot(envName, projectRoot), targetPath);
    },
  };
}

module.exports = { createAdapter };
