const fs = require("fs");
const path = require("path");
const os = require("os");

const { checkTddGate } = require("../lib/tdd_gate");

function createTempDir() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "tdd-gate-test-")));
}

describe("checkTddGate", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
    delete process.env.TDD_SKIP;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- 3.4: only activates on ready_to_apply ---

  test("not_initialized 状态下放行", () => {
    const result = checkTddGate("lib/foo.js", tmpDir, "not_initialized");
    expect(result).toBeNull();
  });

  test("no_active_change 状态下放行", () => {
    const result = checkTddGate("lib/foo.js", tmpDir, "no_active_change");
    expect(result).toBeNull();
  });

  test("planning 状态下放行", () => {
    const result = checkTddGate("lib/foo.js", tmpDir, "planning");
    expect(result).toBeNull();
  });

  test("ready_to_apply + 无测试文件 → 阻断", () => {
    const result = checkTddGate("lib/foo.js", tmpDir, "ready_to_apply");
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
    expect(result.reason).toContain("[TDD]");
  });

  // --- 3.1: whitelist patterns ---

  test("测试文件本身放行：*.test.js", () => {
    expect(checkTddGate("lib/foo.test.js", tmpDir, "ready_to_apply")).toBeNull();
  });

  test("测试文件本身放行：*.spec.js", () => {
    expect(checkTddGate("lib/foo.spec.js", tmpDir, "ready_to_apply")).toBeNull();
  });

  test("测试文件本身放行：__tests__/ 目录", () => {
    expect(checkTddGate("hooks/__tests__/foo.test.js", tmpDir, "ready_to_apply")).toBeNull();
  });

  test("配置文件放行：package.json", () => {
    expect(checkTddGate("package.json", tmpDir, "ready_to_apply")).toBeNull();
  });

  test("配置文件放行：jest.config.js", () => {
    expect(checkTddGate("jest.config.js", tmpDir, "ready_to_apply")).toBeNull();
  });

  test("配置文件放行：.eslintrc.json", () => {
    expect(checkTddGate(".eslintrc.json", tmpDir, "ready_to_apply")).toBeNull();
  });

  test("配置文件放行：.prettierrc", () => {
    expect(checkTddGate(".prettierrc", tmpDir, "ready_to_apply")).toBeNull();
  });

  test("文档文件放行：*.md", () => {
    expect(checkTddGate("README.md", tmpDir, "ready_to_apply")).toBeNull();
    expect(checkTddGate("docs/guide.md", tmpDir, "ready_to_apply")).toBeNull();
  });

  test("资源文件放行：*.json", () => {
    expect(checkTddGate("data/config.json", tmpDir, "ready_to_apply")).toBeNull();
  });

  test("资源文件放行：*.yaml / *.yml", () => {
    expect(checkTddGate("config.yaml", tmpDir, "ready_to_apply")).toBeNull();
    expect(checkTddGate("config.yml", tmpDir, "ready_to_apply")).toBeNull();
  });

  test("类型声明放行：*.d.ts", () => {
    expect(checkTddGate("types/index.d.ts", tmpDir, "ready_to_apply")).toBeNull();
  });

  test("bin/ 目录放行", () => {
    expect(checkTddGate("bin/cli.js", tmpDir, "ready_to_apply")).toBeNull();
  });

  // --- 3.2: test file lookup ---

  test("__tests__/<name>.test.js 存在时放行", () => {
    const testDir = path.join(tmpDir, "lib", "__tests__");
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, "foo.test.js"), "test('x', () => {})");

    expect(checkTddGate("lib/foo.js", tmpDir, "ready_to_apply")).toBeNull();
  });

  test("<name>.test.js（同级目录）存在时放行", () => {
    const dir = path.join(tmpDir, "lib");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "foo.test.js"), "test('x', () => {})");

    expect(checkTddGate("lib/foo.js", tmpDir, "ready_to_apply")).toBeNull();
  });

  test("<name>.spec.js（同级目录）存在时放行", () => {
    const dir = path.join(tmpDir, "lib");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "foo.spec.js"), "test('x', () => {})");

    expect(checkTddGate("lib/foo.js", tmpDir, "ready_to_apply")).toBeNull();
  });

  test("hooks 项目结构：hooks/__tests__/pre_tool_use.test.js", () => {
    const testDir = path.join(tmpDir, "hooks", "__tests__");
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, "pre_tool_use.test.js"), "test('x', () => {})");

    expect(checkTddGate("hooks/pre_tool_use.js", tmpDir, "ready_to_apply")).toBeNull();
  });

  test("所有测试路径都不存在时阻断", () => {
    const result = checkTddGate("lib/foo.js", tmpDir, "ready_to_apply");
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
    expect(result.reason).toContain("lib/foo.js");
  });

  // --- 3.3: TDD_SKIP bypass ---

  test("TDD_SKIP=1 放行无测试的实现文件", () => {
    process.env.TDD_SKIP = "1";
    expect(checkTddGate("lib/foo.js", tmpDir, "ready_to_apply")).toBeNull();
  });

  test("TDD_SKIP=1 写入跳过日志", () => {
    process.env.TDD_SKIP = "1";
    checkTddGate("lib/foo.js", tmpDir, "ready_to_apply");
    const logPath = path.join(tmpDir, ".claude", "tdd-skip-log.jsonl");
    expect(fs.existsSync(logPath)).toBe(true);
    const log = JSON.parse(fs.readFileSync(logPath, "utf8").trim());
    expect(log.filePath).toBe("lib/foo.js");
  });

  test("TDD_SKIP 未设置时正常检查", () => {
    const result = checkTddGate("lib/foo.js", tmpDir, "ready_to_apply");
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
  });
});
