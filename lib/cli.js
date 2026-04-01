const { installPlugin, uninstallPlugin } = require("./installer");

const VALID_ACTIONS = new Set(["install", "uninstall"]);
const VALID_CLIS = new Set(["claude", "codex"]);
const VALID_ENVS = new Set(["user", "project"]);

function parseCliList(rawValue) {
  const values = rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (values.length === 0) {
    throw new Error("`--cli` 不能为空");
  }

  const unique = [...new Set(values)];
  for (const value of unique) {
    if (!VALID_CLIS.has(value)) {
      throw new Error(`不支持的 CLI: ${value}`);
    }
  }
  return unique;
}

function parseArgs(argv) {
  const [action, pluginName, ...rest] = argv;

  if (!VALID_ACTIONS.has(action)) {
    throw new Error(
      "用法: plugins <install|uninstall> <plugin-name> [--cli codex,claude] [--env project|user] [--dry-run]"
    );
  }
  if (!pluginName) {
    throw new Error("缺少 <plugin-name>");
  }

  let cliList;
  let envName;
  let dryRun = false;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--cli") {
      cliList = parseCliList(rest[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg === "--env") {
      envName = rest[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`未知参数: ${arg}`);
  }

  if (!cliList) {
    cliList = ["claude"];
  }
  if (!envName) {
    envName = "user";
  }
  if (!VALID_ENVS.has(envName)) {
    throw new Error("`--env` 必须是 project 或 user");
  }

  return { action, pluginName, cliList, envName, dryRun };
}

async function runCli(argv) {
  const options = parseArgs(argv);
  const handlers = {
    install: installPlugin,
    uninstall: uninstallPlugin,
  };

  const results = await handlers[options.action](options);

  for (const result of results) {
    const label = result.cli ?? result.source ?? options.pluginName;
    console.log(`[${label}] ${result.message}`);
  }
}

module.exports = {
  runCli,
  parseArgs,
};
