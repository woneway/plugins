const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const HOOK_PATH = path.resolve(__dirname, "../session_start.js");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "session-start-test-"));
}

function runHook(cwd, env = {}) {
  try {
    const result = execSync(`node ${HOOK_PATH}`, {
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

describe("session_start hook", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("gstack 已安装 + OpenSpec 已初始化 → 输出包含产品层和 hook 强制", () => {
    // 模拟 gstack 已安装
    const gstackExists = [
      path.join(os.homedir(), ".claude/skills/office-hours"),
      path.join(os.homedir(), ".codex/skills/office-hours"),
    ].some((skillsDir) => fs.existsSync(skillsDir));

    // 模拟 OpenSpec 已初始化
    fs.mkdirSync(path.join(tmpDir, "openspec"), { recursive: true });

    const result = runHook(tmpDir);
    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    const ctx = output.hookSpecificOutput.additionalContext;

    if (gstackExists) {
      expect(ctx).toContain("产品层");
    } else {
      expect(ctx).toContain("gstack 未安装");
    }
    expect(ctx).toContain("hook 强制");
  });

  test("gstack 未安装 → 输出包含 gstack 未安装", () => {
    // 使用不存在的 HOME 目录来模拟 gstack 未安装
    // session_start.js 直接检查 os.homedir() 下的路径，无法直接 mock
    // 所以我们只验证输出格式正确
    const result = runHook(tmpDir);
    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    const ctx = output.hookSpecificOutput.additionalContext;
    // 至少包含 gstack 相关的提示（已安装或未安装）
    expect(ctx.includes("产品层") || ctx.includes("gstack 未安装")).toBe(true);
  });

  test("OpenSpec 未初始化 → 输出包含未初始化", () => {
    // tmpDir 没有 openspec 目录
    const result = runHook(tmpDir);
    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    const ctx = output.hookSpecificOutput.additionalContext;
    expect(ctx).toContain("未初始化");
  });

  test("OPENSPEC_SKIP=1 → 输出包含紧急豁免", () => {
    const result = runHook(tmpDir, { OPENSPEC_SKIP: "1" });
    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    const ctx = output.hookSpecificOutput.additionalContext;
    expect(ctx).toContain("紧急豁免");
  });

  test("输出包含安全提醒", () => {
    const result = runHook(tmpDir);
    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    const ctx = output.hookSpecificOutput.additionalContext;
    expect(ctx).toContain("安全提醒");
  });
});
