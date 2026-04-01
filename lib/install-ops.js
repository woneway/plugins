const fs = require("fs");
const path = require("path");

const { createAdapter: createClaudeAdapter } = require("./adapters/claude");
const { createAdapter: createCodexAdapter } = require("./adapters/codex");
const {
  hashFile,
  isFile,
  pathExists,
  removeIfEmpty,
} = require("./fs-utils");

const ADAPTERS = {
  claude: createClaudeAdapter,
  codex: createCodexAdapter,
};

function makeContext({ cli, envName, projectRoot = process.cwd() }) {
  const adapterFactory = ADAPTERS[cli];
  if (!adapterFactory) {
    throw new Error(`CLI adapter 未实现: ${cli}`);
  }

  return {
    cli,
    envName,
    projectRoot,
    adapter: adapterFactory(),
  };
}

function removeManagedPaths(managedPaths, rootPath, dryRun) {
  let removed = 0;
  const remainingPaths = [];

  for (const record of [...managedPaths].reverse()) {
    if (!pathExists(record.path)) {
      continue;
    }

    if (dryRun) {
      removed += 1;
      continue;
    }

    if (record.type === "symlink") {
      const actualTarget = fs.readlinkSync(record.path);
      if (actualTarget !== record.target) {
        remainingPaths.push(record);
        continue;
      }
      fs.unlinkSync(record.path);
      removeIfEmpty(record.path, rootPath);
      removed += 1;
      continue;
    }

    if (record.type === "dir") {
      const entries = fs.readdirSync(record.path);
      if (entries.length > 0) {
        remainingPaths.push(record);
        continue;
      }
      fs.rmdirSync(record.path);
      removeIfEmpty(record.path, rootPath);
      removed += 1;
      continue;
    }

    if (record.type === "file" && isFile(record.path)) {
      if (hashFile(record.path) !== record.hash) {
        remainingPaths.push(record);
        continue;
      }
      fs.unlinkSync(record.path);
      removeIfEmpty(record.path, rootPath);
      removed += 1;
    }
  }

  return { removed, remainingPaths };
}

module.exports = {
  makeContext,
  removeManagedPaths,
};
