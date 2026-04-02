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

test("installer: hooks 安装复制文件并合并 settings.json", async () => {
  const tempDir = createTempDir();
  const previousCwd = process.cwd();
  process.chdir(tempDir);

  try {
    const installResults = await installPlugin({
      action: "install",
      pluginName: "hooks-plugin",
      cliList: ["claude"],
      envName: "project",
      dryRun: false,
      baseDir: getFixturesRoot(),
    });

    assert.equal(installResults.length, 1);

    // Hook 文件已复制
    assert.equal(fs.existsSync(path.join(tempDir, ".claude/hooks/hooks-plugin/test_hook.js")), true);
    assert.equal(fs.existsSync(path.join(tempDir, ".claude/hooks/hooks-plugin/lib/helper.js")), true);

    // __tests__ 和 hooks.json 未复制
    assert.equal(fs.existsSync(path.join(tempDir, ".claude/hooks/hooks-plugin/__tests__")), false);
    assert.equal(fs.existsSync(path.join(tempDir, ".claude/hooks/hooks-plugin/hooks.json")), false);

    // settings.json 已合并
    const settings = JSON.parse(fs.readFileSync(path.join(tempDir, ".claude/settings.json"), "utf8"));
    assert.ok(settings.hooks);
    assert.ok(settings.hooks.PreToolUse);
    assert.equal(settings.hooks.PreToolUse.length, 2);
    assert.equal(settings.hooks.PreToolUse[0].matcher, "Bash");
    assert.ok(settings.hooks.SessionStart);
    assert.equal(settings.hooks.SessionStart.length, 1);

    // 命令路径已解析为绝对路径
    const cmd = settings.hooks.PreToolUse[0].hooks[0].command;
    assert.ok(!cmd.includes("${"), `命令不应包含 env var: ${cmd}`);
    assert.ok(cmd.includes(path.join(tempDir, ".claude/hooks/hooks-plugin")));

    // State 包含 registeredHooks
    const state = JSON.parse(
      fs.readFileSync(path.join(tempDir, ".plugins/state/hooks-plugin/claude.json"), "utf8")
    );
    assert.ok(state.registeredHooks);
    assert.ok(state.registeredHooks.PreToolUse);
    assert.ok(state.registeredHooks.SessionStart);

    // Capability 文件也正常安装
    assert.equal(fs.existsSync(path.join(tempDir, ".claude/rules/test-rule.md")), true);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("installer: hooks 安装幂等，重复安装不产生重复 entries", async () => {
  const tempDir = createTempDir();
  const previousCwd = process.cwd();
  process.chdir(tempDir);

  try {
    await installPlugin({
      action: "install",
      pluginName: "hooks-plugin",
      cliList: ["claude"],
      envName: "project",
      dryRun: false,
      baseDir: getFixturesRoot(),
    });

    await installPlugin({
      action: "install",
      pluginName: "hooks-plugin",
      cliList: ["claude"],
      envName: "project",
      dryRun: false,
      baseDir: getFixturesRoot(),
    });

    const settings = JSON.parse(fs.readFileSync(path.join(tempDir, ".claude/settings.json"), "utf8"));
    assert.equal(settings.hooks.PreToolUse.length, 2, "PreToolUse 应有 2 个 entries（Bash + Edit），不应重复");
    assert.equal(settings.hooks.SessionStart.length, 1, "SessionStart 应有 1 个 entry，不应重复");
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("installer: hooks 卸载移除 entries 但保留其他 hooks", async () => {
  const tempDir = createTempDir();
  const previousCwd = process.cwd();
  process.chdir(tempDir);

  try {
    // 预置一个 r2c hook
    fs.mkdirSync(path.join(tempDir, ".claude"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, ".claude/settings.json"),
      JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "bash /r2c/hook.sh", timeout: 15 }],
            },
          ],
        },
        effortLevel: "high",
      }, null, 2) + "\n",
      "utf8"
    );

    await installPlugin({
      action: "install",
      pluginName: "hooks-plugin",
      cliList: ["claude"],
      envName: "project",
      dryRun: false,
      baseDir: getFixturesRoot(),
    });

    // 确认合并后两种 hooks 共存
    let settings = JSON.parse(fs.readFileSync(path.join(tempDir, ".claude/settings.json"), "utf8"));
    assert.ok(settings.hooks.PostToolUse, "r2c hook 应存在");
    assert.ok(settings.hooks.PreToolUse, "plugin hook 应存在");

    await uninstallPlugin({
      action: "uninstall",
      pluginName: "hooks-plugin",
      cliList: ["claude"],
      envName: "project",
      dryRun: false,
      baseDir: getFixturesRoot(),
    });

    // Hook 文件已删除
    assert.equal(fs.existsSync(path.join(tempDir, ".claude/hooks/hooks-plugin/test_hook.js")), false);

    // r2c hook 保留，plugin hooks 移除
    settings = JSON.parse(fs.readFileSync(path.join(tempDir, ".claude/settings.json"), "utf8"));
    assert.ok(settings.hooks.PostToolUse, "r2c hook 应保留");
    assert.equal(settings.hooks.PostToolUse.length, 1);
    assert.equal(settings.hooks.PreToolUse, undefined, "plugin PreToolUse 应已移除");
    assert.equal(settings.hooks.SessionStart, undefined, "plugin SessionStart 应已移除");

    // 其他 settings 保留
    assert.equal(settings.effortLevel, "high");
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("installer: hooks dry-run 不修改文件", async () => {
  const tempDir = createTempDir();
  const previousCwd = process.cwd();
  process.chdir(tempDir);

  try {
    const results = await installPlugin({
      action: "install",
      pluginName: "hooks-plugin",
      cliList: ["claude"],
      envName: "project",
      dryRun: true,
      baseDir: getFixturesRoot(),
    });

    assert.match(results[0].message, /dry-run/);
    assert.equal(fs.existsSync(path.join(tempDir, ".claude/hooks/hooks-plugin")), false);
    assert.equal(fs.existsSync(path.join(tempDir, ".claude/settings.json")), false);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("installer: codex hooks 复制文件并写入独立 hooks.json", async () => {
  const tempDir = createTempDir();
  const previousCwd = process.cwd();
  process.chdir(tempDir);

  try {
    await installPlugin({
      action: "install",
      pluginName: "hooks-plugin",
      cliList: ["codex"],
      envName: "project",
      dryRun: false,
      baseDir: getFixturesRoot(),
    });

    // Hook 文件已复制到 codex
    assert.equal(fs.existsSync(path.join(tempDir, ".codex/hooks/hooks-plugin/test_hook.js")), true);
    assert.equal(fs.existsSync(path.join(tempDir, ".codex/hooks/hooks-plugin/lib/helper.js")), true);

    // Codex 使用独立的 hooks.json（��是 settings.json）
    assert.equal(fs.existsSync(path.join(tempDir, ".codex/settings.json")), false);
    assert.equal(fs.existsSync(path.join(tempDir, ".codex/hooks.json")), true);

    const hooksFile = JSON.parse(fs.readFileSync(path.join(tempDir, ".codex/hooks.json"), "utf8"));
    assert.ok(hooksFile.hooks);
    assert.ok(hooksFile.hooks.PreToolUse);
    assert.equal(hooksFile.hooks.PreToolUse.length, 2);
    assert.ok(hooksFile.hooks.SessionStart);

    // 命令路径指向 codex 目录
    const cmd = hooksFile.hooks.PreToolUse[0].hooks[0].command;
    assert.ok(cmd.includes(path.join(tempDir, ".codex/hooks/hooks-plugin")));

    // State 包含 registeredHooks
    const state = JSON.parse(
      fs.readFileSync(path.join(tempDir, ".plugins/state/hooks-plugin/codex.json"), "utf8")
    );
    assert.ok(state.registeredHooks);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("installer: codex hooks 卸载清理 hooks.json", async () => {
  const tempDir = createTempDir();
  const previousCwd = process.cwd();
  process.chdir(tempDir);

  try {
    await installPlugin({
      action: "install",
      pluginName: "hooks-plugin",
      cliList: ["codex"],
      envName: "project",
      dryRun: false,
      baseDir: getFixturesRoot(),
    });

    await uninstallPlugin({
      action: "uninstall",
      pluginName: "hooks-plugin",
      cliList: ["codex"],
      envName: "project",
      dryRun: false,
      baseDir: getFixturesRoot(),
    });

    // Hook 文件已删除
    assert.equal(fs.existsSync(path.join(tempDir, ".codex/hooks/hooks-plugin/test_hook.js")), false);

    // hooks.json 中 hooks 已清空
    const hooksFile = JSON.parse(fs.readFileSync(path.join(tempDir, ".codex/hooks.json"), "utf8"));
    assert.equal(hooksFile.hooks, undefined);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("installer: 无 hooks 插件向后兼容", async () => {
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

    // 不应创建 settings.json 或 hooks 目录
    assert.equal(fs.existsSync(path.join(tempDir, ".claude/settings.json")), false);
    assert.equal(fs.existsSync(path.join(tempDir, ".claude/hooks")), false);

    const state = JSON.parse(
      fs.readFileSync(path.join(tempDir, ".plugins/state/file-plugin/claude.json"), "utf8")
    );
    assert.equal(state.registeredHooks, null);
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
