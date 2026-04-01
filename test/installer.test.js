const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { installPlugin, uninstallPlugin } = require("../lib/installer");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "plugins-installer-"));
}

function getFixturesRoot() {
  return path.join(__dirname, "fixtures");
}

test("installer: install/uninstall multi-plugin (project mode)", async () => {
  const tempDir = createTempDir();
  const previousCwd = process.cwd();
  process.chdir(tempDir);

  try {
    const installResults = await installPlugin({
      action: "install",
      pluginName: "multi-plugin",
      cliList: ["claude", "codex"],
      envName: "project",
      dryRun: false,
      baseDir: getFixturesRoot(),
    });

    assert.equal(installResults.length, 2);

    // Claude 安装验证
    assert.equal(fs.existsSync(path.join(tempDir, ".claude/skills/test-skill/SKILL.md")), true);
    assert.equal(fs.existsSync(path.join(tempDir, ".claude/agents/test-agent.md")), true);
    assert.equal(fs.existsSync(path.join(tempDir, ".claude/rules/test-rule.md")), true);
    assert.equal(fs.existsSync(path.join(tempDir, ".claude/commands/test-cmd/cmd.md")), true);

    // Codex 安装验证
    assert.equal(fs.existsSync(path.join(tempDir, ".codex/skills/test-skill/SKILL.md")), true);
    assert.equal(fs.existsSync(path.join(tempDir, ".codex/agents/test-agent.md")), true);

    // 状态文件验证
    assert.equal(fs.existsSync(path.join(tempDir, ".plugins/state/multi-plugin/claude.json")), true);
    assert.equal(fs.existsSync(path.join(tempDir, ".plugins/state/multi-plugin/codex.json")), true);

    const state = JSON.parse(
      fs.readFileSync(path.join(tempDir, ".plugins/state/multi-plugin/claude.json"), "utf8")
    );
    assert.equal(state.pluginName, "multi-plugin");
    assert.equal(state.version, "2.0.0");
    assert.ok(state.managedPaths.length > 0);

    // 卸载
    const uninstallResults = await uninstallPlugin({
      action: "uninstall",
      pluginName: "multi-plugin",
      cliList: ["claude", "codex"],
      envName: "project",
      dryRun: false,
      baseDir: getFixturesRoot(),
    });

    assert.equal(uninstallResults.length, 2);
    assert.equal(fs.existsSync(path.join(tempDir, ".claude/skills/test-skill/SKILL.md")), false);
    assert.equal(fs.existsSync(path.join(tempDir, ".claude/agents/test-agent.md")), false);
    assert.equal(fs.existsSync(path.join(tempDir, ".codex/skills/test-skill/SKILL.md")), false);
    assert.equal(fs.existsSync(path.join(tempDir, ".plugins/state/multi-plugin/claude.json")), false);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("installer: dry-run install 不写入状态和目标文件", async () => {
  const tempDir = createTempDir();
  const previousCwd = process.cwd();
  process.chdir(tempDir);

  try {
    const results = await installPlugin({
      action: "install",
      pluginName: "multi-plugin",
      cliList: ["claude"],
      envName: "project",
      dryRun: true,
      baseDir: getFixturesRoot(),
    });

    assert.equal(results.length, 1);
    assert.match(results[0].message, /dry-run/);
    assert.equal(fs.existsSync(path.join(tempDir, ".plugins/state/multi-plugin/claude.json")), false);
    assert.equal(fs.existsSync(path.join(tempDir, ".claude/skills/test-skill/SKILL.md")), false);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("installer: 用户修改过的文件不被卸载，state 保留对应条目", async () => {
  const tempDir = createTempDir();
  const previousCwd = process.cwd();
  process.chdir(tempDir);

  try {
    await installPlugin({
      action: "install",
      pluginName: "file-plugin",
      cliList: ["claude"],
      envName: "project",
      dryRun: false,
      baseDir: getFixturesRoot(),
    });

    const targetPath = path.join(tempDir, ".claude/rules/example-rule.md");
    assert.equal(fs.existsSync(targetPath), true);

    // 模拟用户修改
    fs.appendFileSync(targetPath, "\nUser changed this file.\n", "utf8");

    const uninstallResults = await uninstallPlugin({
      action: "uninstall",
      pluginName: "file-plugin",
      cliList: ["claude"],
      envName: "project",
      dryRun: false,
      baseDir: getFixturesRoot(),
    });

    assert.equal(uninstallResults.length, 1);
    // 文件应该保留（用户修改过）
    assert.equal(fs.existsSync(targetPath), true);
    assert.match(uninstallResults[0].message, /移除 0 个路径/);

    // state 应该保留（有未删除的文件）
    const statePath = path.join(tempDir, ".plugins/state/file-plugin/claude.json");
    assert.equal(fs.existsSync(statePath), true);

    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    assert.equal(state.managedPaths.length, 1);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("installer: 插件不存在时抛错", async () => {
  await assert.rejects(
    () =>
      installPlugin({
        action: "install",
        pluginName: "nonexistent",
        cliList: ["claude"],
        envName: "project",
        dryRun: false,
        baseDir: getFixturesRoot(),
      }),
    /插件不存在/
  );
});

test("installer: 未安装的插件卸载时跳过", async () => {
  const tempDir = createTempDir();
  const previousCwd = process.cwd();
  process.chdir(tempDir);

  try {
    const results = await uninstallPlugin({
      action: "uninstall",
      pluginName: "file-plugin",
      cliList: ["claude"],
      envName: "project",
      dryRun: false,
      baseDir: getFixturesRoot(),
    });

    assert.equal(results.length, 1);
    assert.match(results[0].message, /已跳过/);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("installer: version 可选，state 记录 null", async () => {
  const tempDir = createTempDir();
  const previousCwd = process.cwd();
  process.chdir(tempDir);

  // 创建一个没有 version 的临时插件
  const noVerDir = path.join(tempDir, "no-ver-plugin");
  const rulesDir = path.join(noVerDir, "rules");
  fs.mkdirSync(rulesDir, { recursive: true });
  fs.writeFileSync(
    path.join(noVerDir, "plugin.json"),
    JSON.stringify({ name: "no-ver-plugin", capabilities: { rules: "rules/" } }),
    "utf8"
  );
  fs.writeFileSync(path.join(rulesDir, "r.md"), "rule", "utf8");

  try {
    await installPlugin({
      action: "install",
      pluginName: "no-ver-plugin",
      cliList: ["claude"],
      envName: "project",
      dryRun: false,
      baseDir: tempDir,
    });

    const state = JSON.parse(
      fs.readFileSync(path.join(tempDir, ".plugins/state/no-ver-plugin/claude.json"), "utf8")
    );
    assert.equal(state.version, null);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
