const os = require("os");
const path = require("path");

function getRoot(envName, projectRoot) {
  if (envName === "user") {
    return path.join(os.homedir(), ".codex");
  }
  return path.join(projectRoot, ".codex");
}

function createAdapter() {
  return {
    name: "codex",
    detect() {
      return true;
    },
    getRoot,
    resolveTarget(envName, projectRoot, targetPath) {
      return path.join(getRoot(envName, projectRoot), targetPath);
    },
  };
}

module.exports = { createAdapter };
