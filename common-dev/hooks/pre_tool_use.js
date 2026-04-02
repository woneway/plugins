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
// 6. TDD Gate（实现文件必须有对应测试文件）

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { getOpenSpecState, isOpenSpecPath } = require("./lib/openspec");
const { checkApiKeyInDiff, checkApiKeyInContent } = require("./lib/api_key_check");
const { isBashWriteCommand, hasNonOpenSpecWriteTarget, extractWriteTargets } = require("./lib/bash_write_detector");
const { checkVerifyGate } = require("./lib/verify_gate");
const { checkTddGate } = require("./lib/tdd_gate");

// --- 读取 stdin ---

let data;
try {
  data = JSON.parse(fs.readFileSync("/dev/stdin", "utf8"));
} catch {
  process.exit(0);
}

const toolName = data.tool_name ?? "";
const toolInput = data.tool_input ?? {};
const repoRoot = process.cwd();

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
    } catch {
      // git diff 失败不阻断
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
    } catch {
      // fail-open: 内容提取失败不阻断
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
  } catch {
    // 日志写入失败不阻断
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

// --- 6. TDD Gate（实现文件必须有对应测试） ---

if (spec.state === "ready_to_apply") {
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
