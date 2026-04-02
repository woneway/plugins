const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const HOOK_PATH = path.resolve(__dirname, "../pre_tool_use.js");

// Test API key values constructed via concatenation to avoid
// triggering our own API key content check on this test file.
const TEST_SK_KEY = "sk-" + "abcdefghijklmnopqrstuvwx";
const TEST_AKIA_KEY = "AKIA" + "1234567890ABCDEF";
const TEST_GHP_KEY = "ghp_" + "abcdefghijklmnopqrstuvwxyz0123456789";

function createTempDir() {
  // realpathSync 规范化 symlink（macOS /tmp → /private/tmp）
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "pretool-test-")));
}

function runHook(input, cwd, env = {}) {
  try {
    const result = execSync(`node ${HOOK_PATH}`, {
      input: JSON.stringify(input),
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    return { exitCode: 0, stdout: result, stderr: "" };
  } catch (err) {
    return {
      exitCode: err.status,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    };
  }
}

// spawnSync 版本：exit 0 时也能捕获 stderr
function runHookCapturingStderr(input, cwd, env = {}) {
  const result = spawnSync("node", [HOOK_PATH], {
    input: typeof input === "string" ? input : JSON.stringify(input),
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return {
    exitCode: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("pre_tool_use hook", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("Edit + not_initialized → exit 0（兼容模式）", () => {
    const result = runHook({ tool_name: "Edit", tool_input: { file_path: "src/index.js" } }, tmpDir);
    expect(result.exitCode).toBe(0);
  });

  test("Edit + no_active_change → exit 2", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook({ tool_name: "Edit", tool_input: { file_path: "src/index.js" } }, tmpDir);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("变更被阻断");
  });

  test("Edit + planning → exit 2", () => {
    const changeDir = path.join(tmpDir, "openspec/changes/my-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "proposal.md"), "# Proposal");

    const result = runHook({ tool_name: "Edit", tool_input: { file_path: "src/index.js" } }, tmpDir);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("规划阶段");
  });

  test("Edit + ready_to_apply → exit 0", () => {
    const changeDir = path.join(tmpDir, "openspec/changes/my-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "tasks.md"), "# Tasks");
    // TDD gate 要求对应测试文件存在
    const testDir = path.join(tmpDir, "src", "__tests__");
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, "index.test.js"), "test('x', () => {})");

    const result = runHook({ tool_name: "Edit", tool_input: { file_path: "src/index.js" } }, tmpDir);
    expect(result.exitCode).toBe(0);
  });

  test("Write to openspec/ → 始终放行（路径白名单）", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "Write", tool_input: { file_path: "openspec/changes/my-feature/proposal.md" } },
      tmpDir
    );
    expect(result.exitCode).toBe(0);
  });

  test("OPENSPEC_SKIP=1 → exit 0 + 写日志", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "Edit", tool_input: { file_path: "src/index.js" } },
      tmpDir,
      { OPENSPEC_SKIP: "1" }
    );
    expect(result.exitCode).toBe(0);
    const logPath = path.join(tmpDir, ".claude/openspec-skip-log.jsonl");
    expect(fs.existsSync(logPath)).toBe(true);
  });

  test("Bash 无写模式 → exit 0", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "Bash", tool_input: { command: "ls -la" } },
      tmpDir
    );
    expect(result.exitCode).toBe(0);
  });

  test("Bash 写入源文件 + no_active_change → exit 2", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "Bash", tool_input: { command: "echo 'hello' > src/index.js" } },
      tmpDir
    );
    expect(result.exitCode).toBe(2);
  });

  test("Bash openspec 白名单：echo > openspec/changes/feature/proposal.md + no_active_change → exit 0", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "Bash", tool_input: { command: "echo '# Proposal' > openspec/changes/feature/proposal.md" } },
      tmpDir
    );
    expect(result.exitCode).toBe(0);
  });

  test("路径遍历防护：echo > openspec/../src/hack.js + no_active_change → exit 2", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "Bash", tool_input: { command: "echo 'hack' > openspec/../src/hack.js" } },
      tmpDir
    );
    expect(result.exitCode).toBe(2);
  });

  test("sed -i + no_active_change → exit 2", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "Bash", tool_input: { command: "sed -i 's/old/new/' src/index.js" } },
      tmpDir
    );
    expect(result.exitCode).toBe(2);
  });

  test("tee 写源文件 + no_active_change → exit 2", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "Bash", tool_input: { command: "echo hello | tee src/output.js" } },
      tmpDir
    );
    expect(result.exitCode).toBe(2);
  });

  test("MultiEdit + no_active_change → exit 2", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "MultiEdit", tool_input: { file_path: "src/index.js" } },
      tmpDir
    );
    expect(result.exitCode).toBe(2);
  });

  test("MultiEdit + ready_to_apply → exit 0", () => {
    const changeDir = path.join(tmpDir, "openspec/changes/my-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "tasks.md"), "# Tasks");
    const testDir = path.join(tmpDir, "src", "__tests__");
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, "index.test.js"), "test('x', () => {})");

    const result = runHook(
      { tool_name: "MultiEdit", tool_input: { file_path: "src/index.js" } },
      tmpDir
    );
    expect(result.exitCode).toBe(0);
  });

  test("NotebookEdit + no_active_change → exit 2", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "NotebookEdit", tool_input: { file_path: "src/notebook.ipynb" } },
      tmpDir
    );
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("变更被阻断");
  });

  test("NotebookEdit to openspec/ → exit 0（路径白名单）", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "NotebookEdit", tool_input: { file_path: "openspec/changes/my-feature/notebook.ipynb" } },
      tmpDir
    );
    expect(result.exitCode).toBe(0);
  });

  test("NotebookEdit + ready_to_apply → exit 0", () => {
    const changeDir = path.join(tmpDir, "openspec/changes/my-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "tasks.md"), "# Tasks");

    const result = runHook(
      { tool_name: "NotebookEdit", tool_input: { file_path: "src/notebook.ipynb" } },
      tmpDir
    );
    expect(result.exitCode).toBe(0);
  });

  // --- Repo 外路径放行 ---

  test("Write to ~/.claude/ + no_active_change → exit 0（repo 外路径放行）", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "Write", tool_input: { file_path: path.join(os.homedir(), ".claude/projects/memory/test.md"), content: "test" } },
      tmpDir
    );
    expect(result.exitCode).toBe(0);
  });

  test("Edit to ~/.gstack/ + no_active_change → exit 0（repo 外路径放行）", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "Edit", tool_input: { file_path: path.join(os.homedir(), ".gstack/data/file.json"), new_string: "test" } },
      tmpDir
    );
    expect(result.exitCode).toBe(0);
  });

  test("Write to ~/.codex/ + no_active_change → exit 0（repo 外路径放行）", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "Write", tool_input: { file_path: path.join(os.homedir(), ".codex/settings.json"), content: "{}" } },
      tmpDir
    );
    expect(result.exitCode).toBe(0);
  });

  test("Write to repo 内路径 + no_active_change → exit 2（不受 repo 外放行影响）", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "Write", tool_input: { file_path: path.join(tmpDir, "src/index.js"), content: "test" } },
      tmpDir
    );
    expect(result.exitCode).toBe(2);
  });

  // --- Bash repo 外路径放行 ---

  test("Bash touch ~/.gstack/ + no_active_change → exit 0（Bash repo 外路径放行）", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "Bash", tool_input: { command: `touch ${path.join(os.homedir(), ".gstack/sessions/12345")}` } },
      tmpDir
    );
    expect(result.exitCode).toBe(0);
  });

  test("Bash echo >> ~/.gstack/analytics/ + no_active_change → exit 0（Bash repo 外路径放行）", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "Bash", tool_input: { command: `echo '{"skill":"ship"}' >> ${path.join(os.homedir(), ".gstack/analytics/skill-usage.jsonl")}` } },
      tmpDir
    );
    expect(result.exitCode).toBe(0);
  });

  test("Bash mkdir ~/.gstack/ + no_active_change → exit 0（Bash repo 外路径放行）", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "Bash", tool_input: { command: `mkdir -p ${path.join(os.homedir(), ".gstack/sessions")}` } },
      tmpDir
    );
    expect(result.exitCode).toBe(0);
  });

  test("Bash 混合 repo 内外路径 + no_active_change → exit 2（不放行）", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "Bash", tool_input: { command: `cp ${path.join(os.homedir(), ".gstack/template.js")} src/new-file.js` } },
      tmpDir
    );
    expect(result.exitCode).toBe(2);
  });

  test("Bash 写源文件仍被拦截（不受外部路径放行影响）", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook(
      { tool_name: "Bash", tool_input: { command: "echo 'hack' > src/index.js" } },
      tmpDir
    );
    expect(result.exitCode).toBe(2);
  });

  // --- Content API Key Check ---

  test("Write 含 API Key → exit 2", () => {
    const result = runHook(
      { tool_name: "Write", tool_input: { file_path: "src/config.js", content: `const key = "${TEST_SK_KEY}";` } },
      tmpDir
    );
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("[SECURITY]");
  });

  test("Edit new_string 含 API Key → exit 2", () => {
    const result = runHook(
      { tool_name: "Edit", tool_input: { file_path: "src/config.js", new_string: TEST_AKIA_KEY } },
      tmpDir
    );
    expect(result.exitCode).toBe(2);
  });

  test("MultiEdit edits 含 API Key → exit 2", () => {
    const result = runHook(
      { tool_name: "MultiEdit", tool_input: { file_path: "src/config.js", edits: [
        { new_string: "clean code" },
        { new_string: `token = "${TEST_GHP_KEY}"` }
      ] } },
      tmpDir
    );
    expect(result.exitCode).toBe(2);
  });

  test("NotebookEdit new_source 含 API Key → exit 2", () => {
    const result = runHook(
      { tool_name: "NotebookEdit", tool_input: { file_path: "src/nb.ipynb", new_source: `key = "${TEST_SK_KEY}"` } },
      tmpDir
    );
    expect(result.exitCode).toBe(2);
  });

  test("NotebookEdit 无 new_source 字段 → 不崩溃（fail-open）", () => {
    const changeDir = path.join(tmpDir, "openspec/changes/my-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "tasks.md"), "# Tasks");

    const result = runHook(
      { tool_name: "NotebookEdit", tool_input: { file_path: "src/nb.ipynb" } },
      tmpDir
    );
    expect(result.exitCode).toBe(0);
  });

  test("Write 含注释行中的 API Key → 不拦截", () => {
    const result = runHook(
      { tool_name: "Write", tool_input: { file_path: "src/config.js", content: `// API_KEY="${TEST_SK_KEY}"` } },
      tmpDir
    );
    expect(result.exitCode).not.toBe(2);
  });

  test("Write 含 API Key + ready_to_apply → 仍拦截（安全优先）", () => {
    const changeDir = path.join(tmpDir, "openspec/changes/my-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "tasks.md"), "# Tasks");

    const result = runHook(
      { tool_name: "Write", tool_input: { file_path: "src/config.js", content: `const key = "${TEST_SK_KEY}";` } },
      tmpDir
    );
    expect(result.exitCode).toBe(2);
  });

  // --- TDD Gate 集成测试 ---

  test("Edit 实现文件 + ready_to_apply + 无测试 → exit 2（TDD gate）", () => {
    const changeDir = path.join(tmpDir, "openspec/changes/my-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "tasks.md"), "# Tasks");

    const result = runHook({ tool_name: "Edit", tool_input: { file_path: "lib/foo.js" } }, tmpDir);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("[TDD]");
  });

  test("Edit 实现文件 + ready_to_apply + 有测试 → exit 0", () => {
    const changeDir = path.join(tmpDir, "openspec/changes/my-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "tasks.md"), "# Tasks");
    // 创建对应测试文件
    const testDir = path.join(tmpDir, "lib", "__tests__");
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, "foo.test.js"), "test('x', () => {})");

    const result = runHook({ tool_name: "Edit", tool_input: { file_path: "lib/foo.js" } }, tmpDir);
    expect(result.exitCode).toBe(0);
  });

  test("Edit 测试文件 + ready_to_apply → exit 0（白名单）", () => {
    const changeDir = path.join(tmpDir, "openspec/changes/my-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "tasks.md"), "# Tasks");

    const result = runHook({ tool_name: "Edit", tool_input: { file_path: "lib/foo.test.js" } }, tmpDir);
    expect(result.exitCode).toBe(0);
  });

  test("Edit 配置文件 + ready_to_apply → exit 0（白名单）", () => {
    const changeDir = path.join(tmpDir, "openspec/changes/my-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "tasks.md"), "# Tasks");

    const result = runHook({ tool_name: "Edit", tool_input: { file_path: "package.json" } }, tmpDir);
    expect(result.exitCode).toBe(0);
  });

  test("TDD_SKIP=1 + 实现文件无测试 → exit 0", () => {
    const changeDir = path.join(tmpDir, "openspec/changes/my-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "tasks.md"), "# Tasks");

    const result = runHook(
      { tool_name: "Edit", tool_input: { file_path: "lib/foo.js" } },
      tmpDir,
      { TDD_SKIP: "1" }
    );
    expect(result.exitCode).toBe(0);
  });

  test("Edit + not_initialized → exit 0（TDD gate 不激活）", () => {
    // 无 openspec 目录 — 兼容模式，TDD gate 不应阻断
    const result = runHook({ tool_name: "Edit", tool_input: { file_path: "lib/foo.js" } }, tmpDir);
    expect(result.exitCode).toBe(0);
  });

  // --- Verify Gate 集成测试 ---

  test("Bash archive mv 未 verify → 阻断（即使非源文件写操作）", () => {
    // 创建 openspec 目录结构但不创建 .verify-state.json
    const changeDir = path.join(tmpDir, "openspec/changes/my-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "tasks.md"), "# Tasks");

    const result = runHook(
      { tool_name: "Bash", tool_input: { command: "mv openspec/changes/my-feature openspec/changes/archive/2026-04-02-my-feature" } },
      tmpDir
    );
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toMatch(/VERIFY GATE/);
  });

  // --- Fail-open warning 审计 ---

  test("stdin 解析失败 → exit 0 + stderr 包含 [WARN]", () => {
    const result = runHookCapturingStderr("not json", tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("[WARN] pre_tool_use: stdin parse failed");
  });

  test("OPENSPEC_SKIP 日志目录不可写 → exit 0 + stderr 包含 [WARN]", () => {
    // 创建一个文件占据 .claude 路径，使 mkdirSync 失败
    fs.writeFileSync(path.join(tmpDir, ".claude"), "block");
    const changeDir = path.join(tmpDir, "openspec/changes/my-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "tasks.md"), "# Tasks");

    const result = runHookCapturingStderr(
      { tool_name: "Edit", tool_input: { file_path: "src/index.js", new_string: "hello" } },
      tmpDir,
      { OPENSPEC_SKIP: "1" }
    );
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("[WARN] openspec_skip: log write failed");
  });

  test("Bash archive mv 已 verify → 放行", () => {
    const changeDir = path.join(tmpDir, "openspec/changes/my-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "tasks.md"), "# Tasks");
    // 写入合法的 verify 状态文件；commit 用 "unknown" 因为 tmpDir 不是 git repo
    // git 失败 → fail-closed，所以需要初始化 git
    execSync("git init", { cwd: tmpDir, stdio: "ignore" });
    execSync("git config user.email test@test.com", { cwd: tmpDir, stdio: "ignore" });
    execSync("git config user.name test", { cwd: tmpDir, stdio: "ignore" });
    execSync("git add -A && git commit -m init --allow-empty", { cwd: tmpDir, stdio: "ignore" });
    const commit = execSync("git rev-parse --short HEAD", { cwd: tmpDir, encoding: "utf8" }).trim();
    fs.writeFileSync(
      path.join(changeDir, ".verify-state.json"),
      JSON.stringify({ result: "pass", userConfirmed: true, commit, timestamp: new Date().toISOString() })
    );

    const result = runHook(
      { tool_name: "Bash", tool_input: { command: "mv openspec/changes/my-feature openspec/changes/archive/2026-04-02-my-feature" } },
      tmpDir
    );
    expect(result.exitCode).toBe(0);
  });

  // --- Change-scope binding 测试 ---

  describe("change-scope binding", () => {
    let scopeDir;

    beforeEach(() => {
      scopeDir = createTempDir();
      // 创建一个 ready_to_apply 的 change
      const changeDir = path.join(scopeDir, "openspec/changes/my-feature");
      fs.mkdirSync(changeDir, { recursive: true });
      fs.writeFileSync(
        path.join(changeDir, "tasks.md"),
        "- [x] `src/lib/foo.js` — implement\n- [x] `src/lib/bar.js` — implement"
      );
      // 创建 current-change 标记
      fs.mkdirSync(path.join(scopeDir, ".claude"), { recursive: true });
      fs.writeFileSync(path.join(scopeDir, ".claude/current-change"), "my-feature");
    });

    afterEach(() => {
      fs.rmSync(scopeDir, { recursive: true, force: true });
    });

    test("scope 内文件放行", () => {
      // 创建对应测试文件使 TDD gate 通过
      const testDir = path.join(scopeDir, "src/lib/__tests__");
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, "foo.test.js"), "test('x', () => {})");

      const result = runHook(
        { tool_name: "Edit", tool_input: { file_path: "src/lib/foo.js", new_string: "code" } },
        scopeDir
      );
      expect(result.exitCode).toBe(0);
    });

    test("scope 外文件阻断", () => {
      const result = runHook(
        { tool_name: "Edit", tool_input: { file_path: "other/baz.js", new_string: "code" } },
        scopeDir
      );
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("[SCOPE]");
    });

    test("测试文件配对放行：__tests__/<name>.test.js", () => {
      const result = runHook(
        { tool_name: "Edit", tool_input: { file_path: "src/lib/__tests__/foo.test.js", new_string: "test" } },
        scopeDir
      );
      expect(result.exitCode).toBe(0);
    });

    test("测试文件配对放行：<name>.test.js 同级目录", () => {
      const result = runHook(
        { tool_name: "Edit", tool_input: { file_path: "src/lib/foo.test.js", new_string: "test" } },
        scopeDir
      );
      expect(result.exitCode).toBe(0);
    });

    test("测试文件配对放行：<name>.spec.js", () => {
      const result = runHook(
        { tool_name: "Edit", tool_input: { file_path: "src/lib/bar.spec.js", new_string: "test" } },
        scopeDir
      );
      expect(result.exitCode).toBe(0);
    });

    test("目录前缀匹配：scope 内目录的子文件放行", () => {
      const testDir = path.join(scopeDir, "src/lib/__tests__");
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, "utils.test.js"), "test('x', () => {})");

      const result = runHook(
        { tool_name: "Edit", tool_input: { file_path: "src/lib/utils.js", new_string: "code" } },
        scopeDir
      );
      expect(result.exitCode).toBe(0);
    });

    test("空 paths → warn + fallback 放行", () => {
      const changeDir = path.join(scopeDir, "openspec/changes/my-feature");
      fs.writeFileSync(path.join(changeDir, "tasks.md"), "- [x] 实现新功能\n- [x] 编写测试");
      const testDir = path.join(scopeDir, "src/__tests__");
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, "index.test.js"), "test('x', () => {})");

      const result = runHookCapturingStderr(
        { tool_name: "Edit", tool_input: { file_path: "src/index.js", new_string: "code" } },
        scopeDir
      );
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("[WARN] change-scope: no paths extracted");
    });

    test("current-change 不存在 + 单 change → 自动绑定 + scope 内放行", () => {
      fs.unlinkSync(path.join(scopeDir, ".claude/current-change"));
      const testDir = path.join(scopeDir, "src/lib/__tests__");
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, "foo.test.js"), "test('x', () => {})");

      const result = runHook(
        { tool_name: "Edit", tool_input: { file_path: "src/lib/foo.js", new_string: "code" } },
        scopeDir
      );
      expect(result.exitCode).toBe(0);
      // 验证自动写入 marker
      expect(fs.existsSync(path.join(scopeDir, ".claude/current-change"))).toBe(true);
      expect(fs.readFileSync(path.join(scopeDir, ".claude/current-change"), "utf8")).toBe("my-feature");
    });

    test("current-change 不存在 + 单 change → 自动绑定 + scope 外阻断", () => {
      fs.unlinkSync(path.join(scopeDir, ".claude/current-change"));

      const result = runHook(
        { tool_name: "Edit", tool_input: { file_path: "other/baz.js", new_string: "code" } },
        scopeDir
      );
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("[SCOPE]");
    });

    test("current-change 不存在 + 多 change → fallback 放行", () => {
      fs.unlinkSync(path.join(scopeDir, ".claude/current-change"));
      // 添加第二个 ready change
      const changeDir2 = path.join(scopeDir, "openspec/changes/other-feature");
      fs.mkdirSync(changeDir2, { recursive: true });
      fs.writeFileSync(path.join(changeDir2, "tasks.md"), "- [x] `other/thing.js` — implement");
      const testDir = path.join(scopeDir, "src/lib/__tests__");
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, "foo.test.js"), "test('x', () => {})");

      const result = runHook(
        { tool_name: "Edit", tool_input: { file_path: "src/lib/foo.js", new_string: "code" } },
        scopeDir
      );
      expect(result.exitCode).toBe(0);
    });

    test("current-change 指向已删除 change → fallback 放行", () => {
      fs.writeFileSync(path.join(scopeDir, ".claude/current-change"), "deleted-feature");
      const testDir = path.join(scopeDir, "src/lib/__tests__");
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, "foo.test.js"), "test('x', () => {})");

      const result = runHook(
        { tool_name: "Edit", tool_input: { file_path: "src/lib/foo.js", new_string: "code" } },
        scopeDir
      );
      expect(result.exitCode).toBe(0);
    });
  });
});
