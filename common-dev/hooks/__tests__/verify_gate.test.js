const fs = require("fs");
const path = require("path");
const os = require("os");

// mock execSync for git HEAD
jest.mock("child_process", () => ({
  execSync: jest.fn(),
}));
const { execSync } = require("child_process");

const { checkVerifyGate } = require("../lib/verify_gate");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "verify-gate-test-"));
}

function writeStateFile(tmpDir, changeName, state) {
  const changeDir = path.join(tmpDir, "openspec", "changes", changeName);
  fs.mkdirSync(changeDir, { recursive: true });
  fs.writeFileSync(
    path.join(changeDir, ".verify-state.json"),
    JSON.stringify(state),
    "utf8"
  );
}

const ARCHIVE_CMD = (name) =>
  `mv openspec/changes/${name} openspec/changes/archive/2026-04-02-${name}`;

describe("checkVerifyGate", () => {
  let tmpDir;
  const CURRENT_COMMIT = "abc1234";

  beforeEach(() => {
    tmpDir = createTempDir();
    execSync.mockReturnValue(CURRENT_COMMIT + "\n");
    delete process.env.OPENSPEC_SKIP;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  test("非 archive 命令放行", () => {
    expect(checkVerifyGate("npm test", tmpDir)).toBeNull();
    expect(checkVerifyGate("git commit -m 'fix'", tmpDir)).toBeNull();
    expect(checkVerifyGate("mv foo bar", tmpDir)).toBeNull();
    expect(checkVerifyGate("mkdir openspec/changes/archive", tmpDir)).toBeNull();
  });

  test("OPENSPEC_SKIP=1 豁免", () => {
    process.env.OPENSPEC_SKIP = "1";
    expect(checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir)).toBeNull();
  });

  test("状态文件不存在时阻断", () => {
    const result = checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir);
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
    expect(result.reason).toMatch(/未运行 verify/);
  });

  test("verify pass + commit 匹配时放行", () => {
    writeStateFile(tmpDir, "my-feature", {
      result: "pass",
      userConfirmed: true,
      commit: CURRENT_COMMIT,
      timestamp: new Date().toISOString(),
    });
    expect(checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir)).toBeNull();
  });

  test("verify warn + 用户已确认时放行", () => {
    writeStateFile(tmpDir, "my-feature", {
      result: "warn",
      userConfirmed: true,
      commit: CURRENT_COMMIT,
      timestamp: new Date().toISOString(),
    });
    expect(checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir)).toBeNull();
  });

  test("verify warn + 用户未确认时阻断", () => {
    writeStateFile(tmpDir, "my-feature", {
      result: "warn",
      userConfirmed: false,
      commit: CURRENT_COMMIT,
      timestamp: new Date().toISOString(),
    });
    const result = checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir);
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
    expect(result.reason).toMatch(/warn.*未确认/);
  });

  test("commit 不匹配时阻断（verify 过期）", () => {
    writeStateFile(tmpDir, "my-feature", {
      result: "pass",
      userConfirmed: true,
      commit: "oldcommit",
      timestamp: new Date().toISOString(),
    });
    const result = checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir);
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
    expect(result.reason).toMatch(/过期/);
  });

  test("状态文件损坏时阻断", () => {
    const changeDir = path.join(tmpDir, "openspec", "changes", "my-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, ".verify-state.json"), "not-json");
    const result = checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir);
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
    expect(result.reason).toMatch(/损坏/);
  });

  test("git HEAD 获取失败时不因此阻断（commit 为 null 时跳过比对）", () => {
    execSync.mockImplementation(() => {
      throw new Error("not a git repo");
    });
    writeStateFile(tmpDir, "my-feature", {
      result: "pass",
      userConfirmed: true,
      commit: "abc1234",
      timestamp: new Date().toISOString(),
    });
    expect(checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir)).toBeNull();
  });
});
