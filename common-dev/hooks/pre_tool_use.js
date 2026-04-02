#!/usr/bin/env node
// PreToolUse: OpenSpec 工作流门禁 + API Key 保护（编排器）
//
// 检查顺序：
// 1. API Key 检查（git commit/add 始终运行，不受 OpenSpec 状态影响）
// 1b. API Key 内容检查（Write/Edit/MultiEdit/NotebookEdit）
// 1c. Verify Gate（archive mv 命令检查 — 独立于写操作检测）
// 2. 判断是否为写操作
// 2b. Repo 外路径放行
// 3. OpenSpec 路径白名单（openspec/ 目录写入始终放行）
// 4. OPENSPEC_SKIP 豁免
// 5. OpenSpec 工作流门禁
// 6. Change-scope binding（当前 change 范围校验）
// 7. TDD Gate（实现文件必须有对应测试文件）

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { getOpenSpecState, isOpenSpecPath, extractPathsFromTasks } = require("./lib/openspec");
const { checkApiKeyInDiff, checkApiKeyInContent } = require("./lib/api_key_check");
const { isBashWriteCommand, hasNonOpenSpecWriteTarget, extractWriteTargets } = require("./lib/bash_write_detector");
const { checkVerifyGate } = require("./lib/verify_gate");
const { checkTddGate } = require("./lib/tdd_gate");
const { getRepoRoot } = require("./lib/repo_root");

// --- 读取 stdin ---

let data;
try {
  data = JSON.parse(fs.readFileSync("/dev/stdin", "utf8"));
} catch (e) {
  process.stderr.write(`[WARN] pre_tool_use: stdin parse failed - ${e.message}\n`);
  process.exit(0);
}

const toolName = data.tool_name ?? "";
const toolInput = data.tool_input ?? {};
const repoRoot = getRepoRoot();

// --- 1. API Key 检查（始终先运行） ---

if (toolName === "Bash") {
  const cmd = toolInput.command ?? "";

  if (/\bgit\s+(commit|add)\b/.test(cmd)) {
    let diff;
    try {
      diff = execSync("git diff --cached", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
    } catch (e) {
      process.stderr.write(`[WARN] api_key_check: git diff failed - ${e.message}\n`);
    }

    if (diff) {
      const result = checkApiKeyInDiff(diff);
      if (result.found) {
        process.stderr.write(
          `[SECURITY] 检测到 ${result.count} 处疑似硬编码 API Key，请改用环境变量\n`
        );
        process.exit(2);
      }
    }
  }
}

// --- 1b. API Key 内容检查（Write/Edit/MultiEdit/NotebookEdit） ---

{
  const CONTENT_TOOLS = {
    Write: (input) => input.content ?? "",
    Edit: (input) => input.new_string ?? "",
    MultiEdit: (input) =>
      (input.edits ?? []).map((e) => e.new_string ?? "").join("\n"),
    NotebookEdit: (input) => input.new_source ?? "",
  };

  const extractor = CONTENT_TOOLS[toolName];
  if (extractor) {
    try {
      const content = extractor(toolInput);
      if (content) {
        const result = checkApiKeyInContent(content);
        if (result.found) {
          process.stderr.write(
            `[SECURITY] 检测到 ${result.count} 处疑似硬编码 API Key，请改用环境变量\n`
          );
          process.exit(2);
        }
      }
    } catch (e) {
      process.stderr.write(`[WARN] api_key_check: content extraction failed - ${e.message}\n`);
    }
  }
}

// --- 1c. Verify Gate（archive mv 命令检查） ---
// 独立于写操作检测：archive mv 不是"源文件写入"，但需要 verify 门禁拦截

if (toolName === "Bash") {
  const cmd = toolInput.command ?? "";
  const vg = checkVerifyGate(cmd, repoRoot);
  if (vg && vg.block) {
    process.stderr.write(vg.reason + "\n");
    process.exit(2);
  }
}

// --- 2. 判断是否为写操作 ---

function isWriteOperation() {
  if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(toolName)) return true;

  if (toolName === "Bash") {
    const cmd = toolInput.command ?? "";
    return isBashWriteCommand(cmd);
  }

  return false;
}

if (!isWriteOperation()) {
  process.exit(0);
}

// --- 2b. Repo 外路径放行 ---
// OpenSpec 门禁仅管控项目代码变更，repo 外文件（~/.claude/、~/.gstack/、~/.codex/ 等）不受管控

if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(toolName)) {
  const filePath = toolInput.file_path ?? "";
  const resolved = path.resolve(repoRoot, filePath);
  const rel = path.relative(repoRoot, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    process.exit(0);
  }
}

if (toolName === "Bash") {
  const cmd = toolInput.command ?? "";
  const targets = extractWriteTargets(cmd);
  if (targets.length > 0 && targets.every(t => {
    const resolved = path.resolve(repoRoot, t);
    const rel = path.relative(repoRoot, resolved);
    return rel.startsWith("..") || path.isAbsolute(rel);
  })) {
    process.exit(0);
  }
}

// --- 3. OpenSpec 路径白名单 ---

if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(toolName)) {
  const filePath = toolInput.file_path ?? "";
  if (isOpenSpecPath(filePath, repoRoot)) {
    process.exit(0);
  }
}

if (toolName === "Bash") {
  const cmd = toolInput.command ?? "";
  if (/\bopenspec\//.test(cmd) && !hasNonOpenSpecWriteTarget(cmd, repoRoot)) {
    process.exit(0);
  }
}

// --- 4. OPENSPEC_SKIP 豁免 ---

if (process.env.OPENSPEC_SKIP === "1") {
  const logEntry = {
    timestamp: new Date().toISOString(),
    tool: toolName,
    filePath: ["Edit", "Write", "MultiEdit"].includes(toolName) ? (toolInput.file_path ?? "") : undefined,
    command: toolName === "Bash" ? (toolInput.command ?? "").slice(0, 200) : undefined,
  };
  try {
    const runtimeDir = process.env.CODEX_PLUGIN_ROOT ? ".codex" : ".claude";
    const logPath = path.join(repoRoot, runtimeDir, "openspec-skip-log.jsonl");
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + "\n");
  } catch (e) {
    process.stderr.write(`[WARN] openspec_skip: log write failed - ${e.message}\n`);
  }
  process.exit(0);
}

// --- 5. OpenSpec 工作流门禁 ---

const spec = getOpenSpecState(repoRoot);

if (spec.state === "not_initialized") {
  process.exit(0);
}

if (spec.state === "no_active_change") {
  process.stderr.write(
    "[WORKFLOW] 变更被阻断：无活跃的 OpenSpec 变更。\n" +
      "请先运行 /opsx:new <name> 创建变更，完成规划后再执行代码修改。\n"
  );
  process.exit(2);
}

if (spec.state === "planning") {
  process.stderr.write(
    `[WORKFLOW] 变更被阻断：变更（${spec.changes.join(", ")}）尚在规划阶段。\n` +
      "请先运行 /opsx:ff 生成 tasks.md，再运行 /opsx:apply 实施代码。\n"
  );
  process.exit(2);
}

// --- 6. Change-scope binding（当前 change 范围校验） ---

if (spec.state === "ready_to_apply") {
  // 收集写操作目标路径
  let filePaths = [];
  if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(toolName)) {
    const fp = toolInput.file_path ?? "";
    if (fp) {
      const rel = path.relative(repoRoot, path.resolve(repoRoot, fp));
      filePaths.push(rel);
    }
  } else if (toolName === "Bash") {
    const cmd = toolInput.command ?? "";
    filePaths = extractWriteTargets(cmd);
  }

  // 读取 current-change 标记（或从 spec.changes 自动推断）
  const allowedPaths = readChangeScopeAllowedPaths(repoRoot, spec.changes);

  if (allowedPaths !== null) {
    // allowedPaths === [] → warning + fallback 放行
    // allowedPaths.length > 0 → scope 校验
    if (allowedPaths.length > 0) {
      for (const fp of filePaths) {
        if (!isInChangeScope(fp, allowedPaths)) {
          process.stderr.write(
            `[SCOPE] 变更被阻断：文件 ${fp} 不在当前 change 的范围内。\n` +
            `当前 change 允许的路径：${allowedPaths.slice(0, 5).join(", ")}${allowedPaths.length > 5 ? " ..." : ""}\n` +
            `如需修改范围外的文件，请更新 tasks.md 或使用 OPENSPEC_SKIP=1。\n`
          );
          process.exit(2);
        }
      }
    }
  }

  // --- 7. TDD Gate（实现文件必须有对应测试） ---

  for (const fp of filePaths) {
    const tdd = checkTddGate(fp, repoRoot, spec.state);
    if (tdd && tdd.block) {
      process.stderr.write(tdd.reason + "\n");
      process.exit(2);
    }
  }
}

// state === 'ready_to_apply', all gates passed
process.exit(0);

// --- Helper functions ---

/**
 * 读取 current-change 标记文件并提取 allowedPaths
 * @param {string[]} changes - spec.changes 列表（ready_to_apply 的 change 名）
 * @returns {string[] | null}
 *   string[] → 有效的 allowedPaths（可能为空）
 *   null → 无法确定当前 change，fallback 为现有行为（不做 scope 检查）
 */
function readChangeScopeAllowedPaths(repoRoot, changes) {
  // 尝试 .claude/current-change 和 .codex/current-change
  const runtimeDirs = [".claude", ".codex"];
  let changeName = null;

  for (const dir of runtimeDirs) {
    try {
      const markerPath = path.join(repoRoot, dir, "current-change");
      changeName = fs.readFileSync(markerPath, "utf8").trim();
      if (changeName) break;
    } catch {
      // 文件不存在，继续尝试下一个
    }
  }

  // 无标记文件 → 尝试从 spec.changes 自动推断
  if (!changeName) {
    if (changes && changes.length === 1) {
      changeName = changes[0];
      // 自动写入 marker，后续调用不需重复推断
      try {
        const runtimeDir = process.env.CODEX_PLUGIN_ROOT ? ".codex" : ".claude";
        const markerDir = path.join(repoRoot, runtimeDir);
        fs.mkdirSync(markerDir, { recursive: true });
        fs.writeFileSync(path.join(markerDir, "current-change"), changeName);
      } catch {
        // marker 写入失败不影响 scope 校验
      }
    } else {
      return null; // 多个 change 或无 change，fallback
    }
  }

  // 校验 change 目录仍然存在
  const changeDir = path.join(repoRoot, "openspec", "changes", changeName);
  if (!fs.existsSync(changeDir)) {
    return null; // change 已删除，fallback
  }

  // 读取 tasks.md 提取路径
  try {
    const tasksPath = path.join(changeDir, "tasks.md");
    const tasksContent = fs.readFileSync(tasksPath, "utf8");
    const paths = extractPathsFromTasks(tasksContent);

    if (paths.length === 0) {
      process.stderr.write("[WARN] change-scope: no paths extracted from tasks.md\n");
    }

    return paths;
  } catch {
    return null; // tasks.md 不可读，fallback
  }
}

/**
 * 检查文件路径是否在 change scope 内
 * 包含直接匹配、目录前缀匹配和测试文件配对
 */
function isInChangeScope(filePath, allowedPaths) {
  const normalized = filePath.replace(/\\/g, "/");

  // 直接匹配：精确路径或目录前缀
  if (allowedPaths.some((p) => normalized === p || normalized.startsWith(p + "/"))) {
    return true;
  }

  // 测试文件配对：如果目标是 scope 内实现文件的测试文件，放行
  const implFile = getImplFileFromTestPath(normalized);
  if (implFile) {
    return allowedPaths.some((p) => implFile === p || implFile.startsWith(p + "/"));
  }

  return false;
}

/**
 * 从测试文件路径推导对应的实现文件路径
 * 复用 tdd_gate.js 的命名规则：
 *   __tests__/<name>.test.ext → ../<name>.ext
 *   <name>.test.ext → <name>.ext
 *   <name>.spec.ext → <name>.ext
 *
 * @returns {string | null} 实现文件路径，非测试文件返回 null
 */
function getImplFileFromTestPath(testPath) {
  const dir = path.dirname(testPath).replace(/\\/g, "/");
  const base = path.basename(testPath);

  // <name>.test.<ext>
  const testMatch = base.match(/^(.+)\.test\.(\w+)$/);
  if (testMatch) {
    const implName = `${testMatch[1]}.${testMatch[2]}`;
    if (path.basename(dir) === "__tests__") {
      // __tests__/<name>.test.js → ../<name>.js
      const parentDir = path.dirname(dir).replace(/\\/g, "/");
      return parentDir === "." ? implName : `${parentDir}/${implName}`;
    }
    return dir === "." ? implName : `${dir}/${implName}`;
  }

  // <name>.spec.<ext>
  const specMatch = base.match(/^(.+)\.spec\.(\w+)$/);
  if (specMatch) {
    const implName = `${specMatch[1]}.${specMatch[2]}`;
    return dir === "." ? implName : `${dir}/${implName}`;
  }

  return null;
}
