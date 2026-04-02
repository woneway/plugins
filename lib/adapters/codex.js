const os = require("os");
const path = require("path");

function getRoot(envName, projectRoot) {
  if (envName === "user") {
    return path.join(os.homedir(), ".codex");
  }
  return path.join(projectRoot, ".codex");
}

function getHooksConfigPath(envName, projectRoot) {
  return path.join(getRoot(envName, projectRoot), "hooks.json");
}

function createAdapter() {
  return {
    name: "codex",
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
