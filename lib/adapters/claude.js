const os = require("os");
const path = require("path");

function getRoot(envName, projectRoot) {
  if (envName === "user") {
    return path.join(os.homedir(), ".claude");
  }
  return path.join(projectRoot, ".claude");
}

function createAdapter() {
  return {
    name: "claude",
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
