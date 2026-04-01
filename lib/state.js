const fs = require("fs");
const os = require("os");
const path = require("path");

const { ensureDir, pathExists } = require("./fs-utils");

function getStateRoot(envName, projectRoot) {
  if (envName === "user") {
    return path.join(os.homedir(), ".plugins", "state");
  }
  return path.join(projectRoot, ".plugins", "state");
}

function getStatePath({ envName, projectRoot, pluginName, cli }) {
  const root = getStateRoot(envName, projectRoot);
  return path.join(root, pluginName, `${cli}.json`);
}

function loadState(options) {
  const statePath = getStatePath(options);
  if (!pathExists(statePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

function saveState(options, payload) {
  const statePath = getStatePath(options);
  ensureDir(path.dirname(statePath));
  fs.writeFileSync(statePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return statePath;
}

function removeState(options) {
  const statePath = getStatePath(options);
  if (pathExists(statePath)) {
    fs.unlinkSync(statePath);
  }
  return statePath;
}

module.exports = {
  getStatePath,
  loadState,
  removeState,
  saveState,
};
