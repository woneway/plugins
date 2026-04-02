const fs = require("fs");
const path = require("path");
const os = require("os");

const { getOpenSpecState, isOpenSpecPath, extractPathsFromTasks } = require("../lib/openspec");

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

  test("异常时 stderr 包含 [WARN] 且返回 not_initialized", () => {
    // 用文件占位 changes 路径使 readdirSync 失败
    fs.mkdirSync(path.join(tmpDir, "openspec"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "openspec/changes"), "block");

    const stderrChunks = [];
    const origWrite = process.stderr.write;
    process.stderr.write = (chunk) => { stderrChunks.push(chunk); };
    try {
      const result = getOpenSpecState(tmpDir);
      expect(result.state).toBe("not_initialized");
      const output = stderrChunks.join("");
      expect(output).toContain("[WARN] openspec: state read failed");
    } finally {
      process.stderr.write = origWrite;
    }
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

describe("extractPathsFromTasks", () => {
  test("提取 backtick 包裹的路径", () => {
    const content = "- [x] 1.1 `common-dev/hooks/pre_tool_use.js` — fix\n- [ ] 1.2 `common-dev/hooks/lib/openspec.js` — update";
    const paths = extractPathsFromTasks(content);
    expect(paths).toContain("common-dev/hooks/pre_tool_use.js");
    expect(paths).toContain("common-dev/hooks/lib/openspec.js");
  });

  test("提取目录前缀", () => {
    const content = "- [x] `common-dev/hooks/lib/verify_gate.js` — expand";
    const paths = extractPathsFromTasks(content);
    expect(paths).toContain("common-dev/hooks/lib/verify_gate.js");
    expect(paths).toContain("common-dev/hooks/lib");
  });

  test("排除 URL", () => {
    const content = "- 参考 `https://example.com/path/to/doc` 实现";
    const paths = extractPathsFromTasks(content);
    expect(paths).not.toContain("https://example.com/path/to/doc");
    expect(paths).toEqual([]);
  });

  test("排除 openspec/ 路径", () => {
    const content = "- 修改 `openspec/changes/my-feature/tasks.md`";
    const paths = extractPathsFromTasks(content);
    expect(paths).not.toContain("openspec/changes/my-feature/tasks.md");
    expect(paths).toEqual([]);
  });

  test("空内容返回空数组", () => {
    expect(extractPathsFromTasks("")).toEqual([]);
    expect(extractPathsFromTasks(null)).toEqual([]);
    expect(extractPathsFromTasks(undefined)).toEqual([]);
  });

  test("无路径的内容返回空数组", () => {
    const content = "- [ ] 实现新功能\n- [ ] 编写测试";
    expect(extractPathsFromTasks(content)).toEqual([]);
  });

  test("提取裸路径（含 / 和扩展名）", () => {
    const content = "修改 common-dev/hooks/lib/api_key_check.js 中的检测逻辑";
    const paths = extractPathsFromTasks(content);
    expect(paths).toContain("common-dev/hooks/lib/api_key_check.js");
  });

  test("不提取不含 / 的路径", () => {
    const content = "- 修改 `package.json` 和 `index.js`";
    const paths = extractPathsFromTasks(content);
    expect(paths).toEqual([]);
  });

  test("去重：同一路径只出现一次", () => {
    const content = "- `src/lib/foo.js` 需要修改\n- 再次检查 `src/lib/foo.js`";
    const paths = extractPathsFromTasks(content);
    const fooCount = paths.filter(p => p === "src/lib/foo.js").length;
    expect(fooCount).toBe(1);
  });

  test("多层目录前缀只取直接父目录", () => {
    const content = "- `a/b/c/d.js` 需要修改";
    const paths = extractPathsFromTasks(content);
    expect(paths).toContain("a/b/c/d.js");
    expect(paths).toContain("a/b/c");
    // 不递归提取 a/b 和 a
    expect(paths).not.toContain("a/b");
    expect(paths).not.toContain("a");
  });
});
