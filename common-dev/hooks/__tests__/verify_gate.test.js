const fs = require("fs");
const path = require("path");
const os = require("os");

// mock execSync for git HEAD and git status
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

function writeTasksFile(tmpDir, changeName, content) {
  const changeDir = path.join(tmpDir, "openspec", "changes", changeName);
  fs.mkdirSync(changeDir, { recursive: true });
  fs.writeFileSync(path.join(changeDir, "tasks.md"), content, "utf8");
}

const ARCHIVE_CMD = (name) =>
  `mv openspec/changes/${name} openspec/changes/archive/2026-04-02-${name}`;

describe("checkVerifyGate", () => {
  let tmpDir;
  const CURRENT_COMMIT = "abc1234";

  beforeEach(() => {
    tmpDir = createTempDir();
    // Smart mock: git rev-parse returns commit, git status returns clean
    execSync.mockImplementation((cmd) => {
      if (cmd.includes("rev-parse")) return CURRENT_COMMIT + "\n";
      if (cmd.includes("status")) return "";
      return "";
    });
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

  test("verify pass + commit 匹配 + 干净工作区 → 放行", () => {
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

  // --- Bug 2: 畸形状态文件应被阻断 ---

  test("空对象状态文件应阻断", () => {
    writeStateFile(tmpDir, "my-feature", {});
    const result = checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir);
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
  });

  test("无效 result 值应阻断", () => {
    writeStateFile(tmpDir, "my-feature", {
      result: "garbage",
      userConfirmed: false,
      commit: CURRENT_COMMIT,
    });
    const result = checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir);
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
  });

  test("缺少 commit 字段应阻断", () => {
    writeStateFile(tmpDir, "my-feature", {
      result: "pass",
      userConfirmed: true,
    });
    const result = checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir);
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
  });

  // --- Bug 3: 命令变体应被正确匹配 ---

  test("带 ./ 前缀的路径应匹配", () => {
    const result = checkVerifyGate(
      "mv ./openspec/changes/my-feature openspec/changes/archive/2026-04-02-my-feature",
      tmpDir
    );
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
    expect(result.reason).toMatch(/未运行 verify/);
  });

  test("带引号的路径应匹配", () => {
    const result = checkVerifyGate(
      'mv openspec/changes/my-feature "openspec/changes/archive/2026-04-02-my-feature"',
      tmpDir
    );
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
    expect(result.reason).toMatch(/未运行 verify/);
  });

  test("带 command 前缀应匹配", () => {
    const result = checkVerifyGate(
      "command mv openspec/changes/my-feature openspec/changes/archive/2026-04-02-my-feature",
      tmpDir
    );
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
    expect(result.reason).toMatch(/未运行 verify/);
  });

  // --- Bug 4: git 不可用时应 fail-closed ---

  test("git HEAD 获取失败时应阻断（fail-closed）", () => {
    execSync.mockImplementation(() => {
      throw new Error("not a git repo");
    });
    writeStateFile(tmpDir, "my-feature", {
      result: "pass",
      userConfirmed: true,
      commit: "abc1234",
      timestamp: new Date().toISOString(),
    });
    const result = checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir);
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
    expect(result.reason).toMatch(/git/i);
  });

  // --- Task 2.4: cp/rsync 归档检测 ---

  test("cp -r 归档操作应触发 verify gate", () => {
    const result = checkVerifyGate(
      "cp -r openspec/changes/my-feature openspec/changes/archive/2026-04-02-my-feature",
      tmpDir
    );
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
    expect(result.reason).toMatch(/未运行 verify/);
  });

  test("cp -a 归档操作应触发 verify gate", () => {
    const result = checkVerifyGate(
      "cp -a openspec/changes/my-feature openspec/changes/archive/2026-04-02-my-feature",
      tmpDir
    );
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
  });

  test("cp -rf 归档操作应触发 verify gate", () => {
    const result = checkVerifyGate(
      "cp -rf openspec/changes/my-feature openspec/changes/archive/2026-04-02-my-feature",
      tmpDir
    );
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
  });

  test("rsync -a 归档操作应触发 verify gate", () => {
    const result = checkVerifyGate(
      "rsync -a openspec/changes/my-feature/ openspec/changes/archive/2026-04-02-my-feature/",
      tmpDir
    );
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
  });

  test("rsync -av 归档操作应触发 verify gate", () => {
    const result = checkVerifyGate(
      "rsync -av openspec/changes/my-feature/ openspec/changes/archive/",
      tmpDir
    );
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
  });

  test("cp 不带 -r/-a 不触发 verify gate", () => {
    expect(checkVerifyGate(
      "cp openspec/changes/my-feature/file.txt somewhere/",
      tmpDir
    )).toBeNull();
  });

  test("rsync 不带 -a 不触发 verify gate", () => {
    expect(checkVerifyGate(
      "rsync -v openspec/changes/my-feature/ openspec/changes/archive/",
      tmpDir
    )).toBeNull();
  });

  test("cp -r 归档 + verify pass → 放行", () => {
    writeStateFile(tmpDir, "my-feature", {
      result: "pass",
      userConfirmed: true,
      commit: CURRENT_COMMIT,
      timestamp: new Date().toISOString(),
    });
    expect(checkVerifyGate(
      "cp -r openspec/changes/my-feature openspec/changes/archive/2026-04-02-my-feature",
      tmpDir
    )).toBeNull();
  });

  // --- Task 2.5: change-scoped dirty worktree 阻断/放行 ---

  test("change 相关文件有未提交修改 → 阻断", () => {
    writeStateFile(tmpDir, "my-feature", {
      result: "pass",
      userConfirmed: true,
      commit: CURRENT_COMMIT,
      timestamp: new Date().toISOString(),
    });
    writeTasksFile(tmpDir, "my-feature",
      "- [x] `src/lib/foo.js` — implement\n- [x] `src/lib/bar.js` — implement"
    );
    execSync.mockImplementation((cmd) => {
      if (cmd.includes("rev-parse")) return CURRENT_COMMIT + "\n";
      if (cmd.includes("status")) return " M src/lib/foo.js\n";
      return "";
    });
    const result = checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir);
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
    expect(result.reason).toMatch(/未提交的修改/);
    expect(result.reason).toContain("src/lib/foo.js");
  });

  test("无关文件变更 + change scope 有效 → 放行", () => {
    writeStateFile(tmpDir, "my-feature", {
      result: "pass",
      userConfirmed: true,
      commit: CURRENT_COMMIT,
      timestamp: new Date().toISOString(),
    });
    writeTasksFile(tmpDir, "my-feature",
      "- [x] `src/lib/foo.js` — implement"
    );
    execSync.mockImplementation((cmd) => {
      if (cmd.includes("rev-parse")) return CURRENT_COMMIT + "\n";
      // 修改的是 docs/readme.md，不在 change scope 内
      if (cmd.includes("status")) return " M docs/readme.md\n";
      return "";
    });
    expect(checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir)).toBeNull();
  });

  test("untracked-only 变更不阻断", () => {
    writeStateFile(tmpDir, "my-feature", {
      result: "pass",
      userConfirmed: true,
      commit: CURRENT_COMMIT,
      timestamp: new Date().toISOString(),
    });
    execSync.mockImplementation((cmd) => {
      if (cmd.includes("rev-parse")) return CURRENT_COMMIT + "\n";
      // untracked 文件（??）不算 dirty tracked
      if (cmd.includes("status")) return "?? new-file.js\n?? another.js\n";
      return "";
    });
    expect(checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir)).toBeNull();
  });

  // --- Task 2.6: scope fallback + git status failure ---

  test("无 tasks.md → fallback 全 repo 检查 → 有 dirty 阻断", () => {
    writeStateFile(tmpDir, "my-feature", {
      result: "pass",
      userConfirmed: true,
      commit: CURRENT_COMMIT,
      timestamp: new Date().toISOString(),
    });
    // 不写 tasks.md，scope 无法确定
    execSync.mockImplementation((cmd) => {
      if (cmd.includes("rev-parse")) return CURRENT_COMMIT + "\n";
      if (cmd.includes("status")) return " M any-file.js\n";
      return "";
    });
    const result = checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir);
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
    expect(result.reason).toMatch(/未提交的修改/);
  });

  test("无 tasks.md → fallback 全 repo 检查 → 干净放行", () => {
    writeStateFile(tmpDir, "my-feature", {
      result: "pass",
      userConfirmed: true,
      commit: CURRENT_COMMIT,
      timestamp: new Date().toISOString(),
    });
    // 不写 tasks.md
    execSync.mockImplementation((cmd) => {
      if (cmd.includes("rev-parse")) return CURRENT_COMMIT + "\n";
      if (cmd.includes("status")) return "";
      return "";
    });
    expect(checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir)).toBeNull();
  });

  test("tasks.md 无路径 → fallback 全 repo 检查", () => {
    writeStateFile(tmpDir, "my-feature", {
      result: "pass",
      userConfirmed: true,
      commit: CURRENT_COMMIT,
      timestamp: new Date().toISOString(),
    });
    writeTasksFile(tmpDir, "my-feature", "- [x] 实现新功能\n- [x] 编写测试");
    execSync.mockImplementation((cmd) => {
      if (cmd.includes("rev-parse")) return CURRENT_COMMIT + "\n";
      if (cmd.includes("status")) return " M somewhere.js\n";
      return "";
    });
    const result = checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir);
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
  });

  test("git status 失败 → fail-closed", () => {
    writeStateFile(tmpDir, "my-feature", {
      result: "pass",
      userConfirmed: true,
      commit: CURRENT_COMMIT,
      timestamp: new Date().toISOString(),
    });
    let callCount = 0;
    execSync.mockImplementation((cmd) => {
      if (cmd.includes("rev-parse")) return CURRENT_COMMIT + "\n";
      if (cmd.includes("status")) throw new Error("git status failed");
      return "";
    });
    const result = checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir);
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
    expect(result.reason).toMatch(/git status/);
  });

  test("目录前缀匹配：修改目录内子文件 → 阻断", () => {
    writeStateFile(tmpDir, "my-feature", {
      result: "pass",
      userConfirmed: true,
      commit: CURRENT_COMMIT,
      timestamp: new Date().toISOString(),
    });
    writeTasksFile(tmpDir, "my-feature",
      "- [x] `common-dev/hooks/lib/verify_gate.js` — expand"
    );
    execSync.mockImplementation((cmd) => {
      if (cmd.includes("rev-parse")) return CURRENT_COMMIT + "\n";
      // 修改了同目录下的其他文件
      if (cmd.includes("status")) return " M common-dev/hooks/lib/openspec.js\n";
      return "";
    });
    const result = checkVerifyGate(ARCHIVE_CMD("my-feature"), tmpDir);
    expect(result).not.toBeNull();
    expect(result.block).toBe(true);
  });
});
