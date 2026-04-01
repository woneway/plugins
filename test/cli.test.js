const test = require("node:test");
const assert = require("node:assert/strict");

const { parseArgs } = require("../lib/cli");

test("cli: install 完整参数解析", () => {
  const options = parseArgs([
    "install",
    "common-dev",
    "--cli",
    "claude,codex",
    "--env",
    "project",
    "--dry-run",
  ]);

  assert.deepEqual(options, {
    action: "install",
    pluginName: "common-dev",
    cliList: ["claude", "codex"],
    envName: "project",
    dryRun: true,
  });
});

test("cli: uninstall 参数解析", () => {
  const options = parseArgs([
    "uninstall",
    "common-dev",
    "--cli",
    "claude",
    "--env",
    "user",
  ]);

  assert.deepEqual(options, {
    action: "uninstall",
    pluginName: "common-dev",
    cliList: ["claude"],
    envName: "user",
    dryRun: false,
  });
});

test("cli: 省略 --cli 和 --env 时使用默认值", () => {
  const options = parseArgs(["install", "common-dev"]);

  assert.deepEqual(options, {
    action: "install",
    pluginName: "common-dev",
    cliList: ["claude"],
    envName: "user",
    dryRun: false,
  });
});

test("cli: 无效 action 时抛错", () => {
  assert.throws(
    () => parseArgs(["refresh-source", "common-dev"]),
    /用法:/
  );
});

test("cli: 无效 --env 时抛错", () => {
  assert.throws(
    () => parseArgs(["install", "common-dev", "--env", "global"]),
    /--env/
  );
});

test("cli: 缺少 plugin-name 时抛错", () => {
  assert.throws(
    () => parseArgs(["install"]),
    /缺少/
  );
});

test("cli: 未知参数时抛错", () => {
  assert.throws(
    () => parseArgs(["install", "common-dev", "--unknown"]),
    /未知参数/
  );
});
