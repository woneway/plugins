const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const HOOK_PATH = path.resolve(__dirname, "../user_prompt_submit.js");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "userprompt-test-"));
}

function runHook(input, cwd) {
  try {
    const result = execSync(`node ${HOOK_PATH}`, {
      input: JSON.stringify(input),
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
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

describe("user_prompt_submit hook", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("非编码意图 → 无上下文注入", () => {
    const result = runHook({ prompt: "解释一下什么是 OpenSpec" }, tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("");
  });

  test("编码意图 + not_initialized → 提示 openspec init", () => {
    const result = runHook({ prompt: "帮我实现用户登录功能" }, tmpDir);
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.additionalContext).toContain("未初始化 OpenSpec");
    expect(output.hookSpecificOutput.additionalContext).toContain("openspec init");
  });

  test("编码意图 + no_active_change → 注入快速/完整路径引导", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook({ prompt: "帮我实现用户登录功能" }, tmpDir);
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.additionalContext).toContain("快速路径");
    expect(output.hookSpecificOutput.additionalContext).toContain("完整路径");
    expect(output.hookSpecificOutput.additionalContext).toContain("/office-hours");
  });

  test("编码意图 + planning → 注入规划引导 + agent 推荐", () => {
    const changeDir = path.join(tmpDir, "openspec/changes/login-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "proposal.md"), "# Proposal");

    const result = runHook({ prompt: "implement the login feature" }, tmpDir);
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.additionalContext).toContain("规划阶段");
    expect(output.hookSpecificOutput.additionalContext).toContain("Explore agent");
    expect(output.hookSpecificOutput.additionalContext).toContain("Plan agent");
  });

  test("编码意图 + ready_to_apply → 注入实施引导 + tdd 推荐", () => {
    const changeDir = path.join(tmpDir, "openspec/changes/login-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "tasks.md"), "# Tasks");

    const result = runHook({ prompt: "修改用户模块" }, tmpDir);
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.additionalContext).toContain("tasks.md 已就绪");
    expect(output.hookSpecificOutput.additionalContext).toContain("tdd-guide");
    expect(output.hookSpecificOutput.additionalContext).toContain("/review");
  });

  test("/opsx: 命令不触发意图分类", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook({ prompt: "/opsx:new login-feature" }, tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("");
  });

  test("否定模式 → 不识别为编码意图", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook({ prompt: "不要修改这个文件，只是看看" }, tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("");
  });

  test("英文否定模式：don't change the file → 无上下文注入", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook({ prompt: "don't change the file, just explain" }, tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("");
  });

  test("英文否定模式：just explain how it works → 无上下文注入", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = runHook({ prompt: "just explain how it works" }, tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("");
  });
});
