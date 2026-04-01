const fs = require("fs");
const path = require("path");
const os = require("os");

const { getOpenSpecState, isOpenSpecPath } = require("../lib/openspec");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openspec-test-"));
}

describe("getOpenSpecState", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("not_initialized: openspec/changes 目录不存在", () => {
    const result = getOpenSpecState(tmpDir);
    expect(result.state).toBe("not_initialized");
  });

  test("no_active_change: changes 目录存在但为空", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes"), { recursive: true });
    const result = getOpenSpecState(tmpDir);
    expect(result.state).toBe("no_active_change");
  });

  test("no_active_change: 只有 archive 目录", () => {
    fs.mkdirSync(path.join(tmpDir, "openspec/changes/archive"), { recursive: true });
    const result = getOpenSpecState(tmpDir);
    expect(result.state).toBe("no_active_change");
  });

  test("planning: 有活跃变更但无 tasks.md", () => {
    const changeDir = path.join(tmpDir, "openspec/changes/my-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "proposal.md"), "# Proposal");

    const result = getOpenSpecState(tmpDir);
    expect(result.state).toBe("planning");
    expect(result.changes).toEqual(["my-feature"]);
  });

  test("ready_to_apply: 有活跃变更且有 tasks.md", () => {
    const changeDir = path.join(tmpDir, "openspec/changes/my-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "tasks.md"), "# Tasks");

    const result = getOpenSpecState(tmpDir);
    expect(result.state).toBe("ready_to_apply");
    expect(result.changes).toEqual(["my-feature"]);
  });

  test("多个变更：部分有 tasks.md", () => {
    const dir1 = path.join(tmpDir, "openspec/changes/feature-a");
    const dir2 = path.join(tmpDir, "openspec/changes/feature-b");
    fs.mkdirSync(dir1, { recursive: true });
    fs.mkdirSync(dir2, { recursive: true });
    fs.writeFileSync(path.join(dir1, "tasks.md"), "# Tasks");
    // feature-b 没有 tasks.md

    const result = getOpenSpecState(tmpDir);
    expect(result.state).toBe("ready_to_apply");
    expect(result.changes).toEqual(["feature-a"]);
    expect(result.allChanges).toEqual(expect.arrayContaining(["feature-a", "feature-b"]));
    expect(result.planningChanges).toEqual(["feature-b"]);
  });

  test("planning 状态包含 allChanges 和 planningChanges", () => {
    const dir1 = path.join(tmpDir, "openspec/changes/feat-x");
    const dir2 = path.join(tmpDir, "openspec/changes/feat-y");
    fs.mkdirSync(dir1, { recursive: true });
    fs.mkdirSync(dir2, { recursive: true });

    const result = getOpenSpecState(tmpDir);
    expect(result.state).toBe("planning");
    expect(result.allChanges).toEqual(expect.arrayContaining(["feat-x", "feat-y"]));
    expect(result.planningChanges).toEqual(expect.arrayContaining(["feat-x", "feat-y"]));
  });

  test("ready_to_apply 全部有 tasks 时 planningChanges 为空", () => {
    const dir1 = path.join(tmpDir, "openspec/changes/feat-a");
    const dir2 = path.join(tmpDir, "openspec/changes/feat-b");
    fs.mkdirSync(dir1, { recursive: true });
    fs.mkdirSync(dir2, { recursive: true });
    fs.writeFileSync(path.join(dir1, "tasks.md"), "# Tasks");
    fs.writeFileSync(path.join(dir2, "tasks.md"), "# Tasks");

    const result = getOpenSpecState(tmpDir);
    expect(result.state).toBe("ready_to_apply");
    expect(result.changes).toEqual(expect.arrayContaining(["feat-a", "feat-b"]));
    expect(result.planningChanges).toEqual([]);
  });
});

describe("isOpenSpecPath", () => {
  test("openspec 目录内路径返回 true", () => {
    expect(isOpenSpecPath("openspec/changes/my-feature/proposal.md", "/repo")).toBe(true);
    expect(isOpenSpecPath("openspec/specs/main.md", "/repo")).toBe(true);
  });

  test("非 openspec 路径返回 false", () => {
    expect(isOpenSpecPath("src/index.js", "/repo")).toBe(false);
    expect(isOpenSpecPath("package.json", "/repo")).toBe(false);
  });

  test("空路径返回 false", () => {
    expect(isOpenSpecPath("", "/repo")).toBe(false);
    expect(isOpenSpecPath(null, "/repo")).toBe(false);
  });
});
