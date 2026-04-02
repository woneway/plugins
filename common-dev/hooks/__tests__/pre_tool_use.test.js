const { execSync } = require("child_process");
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
});
