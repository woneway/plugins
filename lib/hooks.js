const fs = require("fs");
const path = require("path");

const { ensureDir, copyDirRecursive, copyFileManaged, pathExists } = require("./fs-utils");

const HOOK_COPY_EXCLUDES = new Set(["__tests__", "hooks.json"]);

const ENV_PATTERNS = [
  "${CLAUDE_PLUGIN_ROOT:-${CODEX_PLUGIN_ROOT}}/hooks",
  "${CLAUDE_PLUGIN_ROOT}/hooks",
  "${CODEX_PLUGIN_ROOT}/hooks",
];

function loadHooksManifest(pluginRoot, hooksRelPath) {
  const hooksPath = path.resolve(pluginRoot, hooksRelPath);
  if (!pathExists(hooksPath)) {
    return null;
  }
  const manifest = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
  return manifest.hooks || null;
}

function resolveHookCommands(hooks, installedHooksDir) {
  const resolved = JSON.parse(JSON.stringify(hooks));
  for (const entries of Object.values(resolved)) {
    for (const entry of entries) {
      for (const hook of entry.hooks) {
        for (const pattern of ENV_PATTERNS) {
          hook.command = hook.command.replaceAll(pattern, installedHooksDir);
        }
      }
    }
  }
  return resolved;
}

function hookEntryExists(existingEntries, newEntry) {
  const newCommands = new Set(newEntry.hooks.map((h) => h.command));
  return existingEntries.some((existing) => {
    if ((existing.matcher || "") !== (newEntry.matcher || "")) return false;
    return existing.hooks.some((h) => newCommands.has(h.command));
  });
}

function mergeIntoSettings(settingsPath, resolvedHooks) {
  let settings = {};
  if (pathExists(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  }

  if (!settings.hooks) {
    settings.hooks = {};
  }

  for (const [eventName, entries] of Object.entries(resolvedHooks)) {
    if (!settings.hooks[eventName]) {
      settings.hooks[eventName] = [];
    }
    for (const entry of entries) {
      if (!hookEntryExists(settings.hooks[eventName], entry)) {
        settings.hooks[eventName].push(entry);
      }
    }
  }

  ensureDir(path.dirname(settingsPath));
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function unmergeFromSettings(settingsPath, registeredHooks) {
  if (!pathExists(settingsPath)) {
    return;
  }

  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  if (!settings.hooks) {
    return;
  }

  const commandsToRemove = new Set();
  for (const entries of Object.values(registeredHooks)) {
    for (const entry of entries) {
      for (const hook of entry.hooks) {
        commandsToRemove.add(hook.command);
      }
    }
  }

  for (const eventName of Object.keys(settings.hooks)) {
    settings.hooks[eventName] = settings.hooks[eventName].filter((entry) => {
      return !entry.hooks.some((h) => commandsToRemove.has(h.command));
    });
    if (settings.hooks[eventName].length === 0) {
      delete settings.hooks[eventName];
    }
  }

  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function copyHooksFiltered(sourceDir, targetDir) {
  const managedPaths = [];
  ensureDir(targetDir);
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (HOOK_COPY_EXCLUDES.has(entry.name)) continue;
    const src = path.join(sourceDir, entry.name);
    const dst = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      ensureDir(dst);
      managedPaths.push(...copyDirRecursive(src, dst));
    } else if (entry.isFile()) {
      managedPaths.push(copyFileManaged(src, dst));
    }
  }
  return managedPaths;
}

function walkDirForPlan(sourceDir, targetDir) {
  const planned = [];
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (HOOK_COPY_EXCLUDES.has(entry.name)) continue;
    const dst = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      planned.push({ path: dst, type: "dir" });
      planned.push(...walkDirForPlan(path.join(sourceDir, entry.name), dst));
    } else if (entry.isFile()) {
      planned.push({ path: dst, type: "file" });
    }
  }
  return planned;
}

function installHooks({ pluginRoot, pluginName, meta, adapter, envName, projectRoot, rootPath, dryRun }) {
  if (!meta.hooks) {
    return { managedPaths: [], registeredHooks: null };
  }

  const hooks = loadHooksManifest(pluginRoot, meta.hooks);
  if (!hooks) {
    return { managedPaths: [], registeredHooks: null };
  }

  const hooksSourceDir = path.resolve(pluginRoot, path.dirname(meta.hooks));
  const installedHooksDir = path.join(rootPath, "hooks", pluginName);

  if (dryRun) {
    const plannedPaths = walkDirForPlan(hooksSourceDir, installedHooksDir);
    const resolvedHooks = resolveHookCommands(hooks, installedHooksDir);
    return { managedPaths: plannedPaths, registeredHooks: resolvedHooks };
  }

  const managedPaths = copyHooksFiltered(hooksSourceDir, installedHooksDir);
  const resolvedHooks = resolveHookCommands(hooks, installedHooksDir);

  if (adapter.supportsHooks) {
    const settingsPath = adapter.getHooksConfigPath(envName, projectRoot);
    if (settingsPath) {
      mergeIntoSettings(settingsPath, resolvedHooks);
    }
  }

  return { managedPaths, registeredHooks: resolvedHooks };
}

function uninstallHooks(state, { adapter, envName, projectRoot, dryRun }) {
  if (!state.registeredHooks || dryRun) {
    return;
  }

  if (adapter.supportsHooks) {
    const settingsPath = adapter.getHooksConfigPath(envName, projectRoot);
    if (settingsPath) {
      unmergeFromSettings(settingsPath, state.registeredHooks);
    }
  }
}

module.exports = {
  loadHooksManifest,
  resolveHookCommands,
  installHooks,
  uninstallHooks,
};
