const fs = require("fs");
const path = require("path");

const { pathExists, isDirectory, copyDirRecursive, copyFileManaged, ensureDir } = require("./fs-utils");
const { makeContext, removeManagedPaths } = require("./install-ops");
const { loadState, removeState, saveState } = require("./state");
const { installHooks, uninstallHooks } = require("./hooks");

function getWorkspaceRoot() {
  return path.resolve(__dirname, "..");
}

function loadPlugin(pluginName, baseDir = getWorkspaceRoot()) {
  const pluginRoot = path.join(baseDir, pluginName);
  if (!pathExists(pluginRoot)) {
    throw new Error(`插件不存在: ${pluginName}`);
  }

  const pluginMetaPath = path.join(pluginRoot, "plugin.json");
  if (!pathExists(pluginMetaPath)) {
    throw new Error(`缺少插件声明: ${pluginMetaPath}`);
  }

  const meta = JSON.parse(fs.readFileSync(pluginMetaPath, "utf8"));
  if (!meta.name) {
    throw new Error(`plugin.json 缺少必需字段: name`);
  }
  if (!meta.capabilities || typeof meta.capabilities !== "object" || Array.isArray(meta.capabilities)) {
    throw new Error(`plugin.json 缺少必需字段: capabilities (须为对象映射)`);
  }

  return { pluginRoot, meta };
}

function installCapability(pluginRoot, capSourceDir, targetDir, managedPaths, dryRun) {
  const sourcePath = path.resolve(pluginRoot, capSourceDir);
  if (!pathExists(sourcePath) || !isDirectory(sourcePath)) {
    return;
  }

  for (const entry of fs.readdirSync(sourcePath, { withFileTypes: true })) {
    const childSource = path.join(sourcePath, entry.name);
    const childTarget = path.join(targetDir, entry.name);

    if (dryRun) {
      managedPaths.push({ path: childTarget, type: entry.isDirectory() ? "dir" : "file" });
      continue;
    }

    if (entry.isDirectory()) {
      ensureDir(childTarget);
      managedPaths.push(...copyDirRecursive(childSource, childTarget));
    } else if (entry.isFile()) {
      managedPaths.push(copyFileManaged(childSource, childTarget));
    }
  }
}

function installForCli(options, plugin, cli) {
  const context = makeContext({ cli, envName: options.envName });
  const rootPath = context.adapter.getRoot(context.envName, context.projectRoot);
  const managedPaths = [];

  for (const [capType, capDir] of Object.entries(plugin.meta.capabilities)) {
    const targetDir = path.join(rootPath, capType);
    installCapability(plugin.pluginRoot, capDir, targetDir, managedPaths, options.dryRun);
  }

  const hookResult = installHooks({
    pluginRoot: plugin.pluginRoot,
    pluginName: options.pluginName,
    meta: plugin.meta,
    adapter: context.adapter,
    envName: options.envName,
    projectRoot: context.projectRoot,
    rootPath,
    dryRun: options.dryRun,
  });
  managedPaths.push(...hookResult.managedPaths);

  if (!options.dryRun) {
    saveState(
      {
        envName: options.envName,
        projectRoot: context.projectRoot,
        pluginName: options.pluginName,
        cli,
      },
      {
        pluginName: options.pluginName,
        cli,
        env: options.envName,
        version: plugin.meta.version ?? null,
        installedAt: new Date().toISOString(),
        managedPaths,
        registeredHooks: hookResult.registeredHooks,
      }
    );
  }

  return {
    cli,
    message: options.dryRun
      ? `dry-run: 计划处理 ${managedPaths.length} 个路径`
      : `已安装 ${options.pluginName}，受管路径 ${managedPaths.length} 个`,
  };
}

function uninstallForCli(options, plugin, cli) {
  const context = makeContext({ cli, envName: options.envName });
  const state = loadState({
    envName: options.envName,
    projectRoot: context.projectRoot,
    pluginName: options.pluginName,
    cli,
  });

  if (!state) {
    return { cli, message: "未找到安装记录，已跳过" };
  }

  const rootPath = context.adapter.getRoot(context.envName, context.projectRoot);
  const { removed, remainingPaths } = removeManagedPaths(state.managedPaths, rootPath, options.dryRun);

  uninstallHooks(state, {
    adapter: context.adapter,
    envName: options.envName,
    projectRoot: context.projectRoot,
    dryRun: options.dryRun,
  });

  if (!options.dryRun) {
    if (remainingPaths.length > 0) {
      saveState(
        {
          envName: options.envName,
          projectRoot: context.projectRoot,
          pluginName: options.pluginName,
          cli,
        },
        { ...state, managedPaths: remainingPaths }
      );
    } else {
      removeState({
        envName: options.envName,
        projectRoot: context.projectRoot,
        pluginName: options.pluginName,
        cli,
      });
    }
  }

  return {
    cli,
    message: options.dryRun
      ? `dry-run: 计划卸载 ${options.pluginName}，将移除 ${removed} 个路径`
      : `已卸载 ${options.pluginName}，移除 ${removed} 个路径`,
  };
}

async function installPlugin(options) {
  const plugin = loadPlugin(options.pluginName, options.baseDir);
  return options.cliList.map((cli) => installForCli(options, plugin, cli));
}

async function uninstallPlugin(options) {
  const plugin = loadPlugin(options.pluginName, options.baseDir);
  return options.cliList.map((cli) => uninstallForCli(options, plugin, cli));
}

module.exports = {
  installPlugin,
  uninstallPlugin,
};
