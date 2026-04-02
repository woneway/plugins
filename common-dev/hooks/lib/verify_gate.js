// verify_gate.js — archive 前 verify 状态门禁
//
// 检测 bash 命令是否为 archive 操作（mv、cp -r/-a、rsync -a），
// 若是则检查对应变更的 verify 状态文件。
// 状态文件由 /opsx:verify skill 写入，包含 result、userConfirmed、commit、timestamp。
//
// 放行条件：
//   - 命令不是 archive 操作
//   - OPENSPEC_SKIP=1（紧急豁免）
//   - 状态文件存在、commit 匹配当前 HEAD、result=pass 或 (result=warn && userConfirmed=true)
//   - 无 change-scoped dirty worktree（change 相关的 tracked 文件无未提交修改）
//
// 阻断条件：
//   - 状态文件不存在（未运行 verify）
//   - commit 不匹配（verify 已过期）
//   - result=warn 且 userConfirmed=false（warn 未确认）
//   - change 相关 tracked 文件有未提交修改

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { extractPathsFromTasks } = require("./openspec");

// 归档操作检测模式：mv、cp -r/-a、rsync -a
// 支持 ./前缀、引号包裹、command 前缀、尾部斜杠等变体
const ARCHIVE_PATTERNS = [
  // mv openspec/changes/<name> to archive/
  /\bmv\s+["']?\.?\/?openspec\/changes\/([^/\s"']+)\/?["']?\s+["']?\.?\/?openspec\/changes\/archive\//,
  // cp -r/-a (flags 含 r 或 a) openspec/changes/<name> to archive/
  /\bcp\s+-[a-z]*[ra][a-z]*\s+["']?\.?\/?openspec\/changes\/([^/\s"']+)\/?["']?\s+["']?\.?\/?openspec\/changes\/archive\//,
  // rsync -a... (flags 含 a) openspec/changes/<name>/ to archive/
  /\brsync\s+-[a-z]*a[a-z]*\s+["']?\.?\/?openspec\/changes\/([^/\s"']+)\/?["']?\s+["']?\.?\/?openspec\/changes\/archive\//,
];

function extractArchiveChangeName(command) {
  for (const pattern of ARCHIVE_PATTERNS) {
    const match = command.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * 检查 bash 命令是否触发 verify gate。
 *
 * @param {string} command - bash 命令字符串
 * @param {string} repoRoot - 仓库根目录绝对路径
 * @returns {{ block: true, reason: string } | null}
 *   null = 放行；{ block: true, reason } = 阻断
 */
function checkVerifyGate(command, repoRoot) {
  // OPENSPEC_SKIP=1 豁免
  if (process.env.OPENSPEC_SKIP === "1") {
    return null;
  }

  // 规范化命令：去掉 command 前缀
  const normalized = command.replace(/^\s*command\s+/, "");

  const changeName = extractArchiveChangeName(normalized);
  if (!changeName) {
    return null; // 非 archive 操作，放行
  }

  const changeDir = path.join(repoRoot, "openspec", "changes", changeName);
  const stateFile = path.join(changeDir, ".verify-state.json");

  // 状态文件不存在 → 未运行 verify
  if (!fs.existsSync(stateFile)) {
    return {
      block: true,
      reason: `[VERIFY GATE] 归档被阻断：变更「${changeName}」未运行 verify。\n请先执行 /opsx:verify 验证实施质量，再归档。`,
    };
  }

  let state;
  try {
    state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {
    return {
      block: true,
      reason: `[VERIFY GATE] 归档被阻断：verify 状态文件损坏，请重新运行 /opsx:verify。`,
    };
  }

  // 必填字段校验：result 必须是 pass 或 warn
  if (!state.result || !["pass", "warn"].includes(state.result)) {
    return {
      block: true,
      reason: `[VERIFY GATE] 归档被阻断：verify 状态文件无效（result 字段缺失或不合法）。\n请重新运行 /opsx:verify。`,
    };
  }

  // 必填字段校验：commit 必须存在
  if (!state.commit) {
    return {
      block: true,
      reason: `[VERIFY GATE] 归档被阻断：verify 状态文件缺少 commit 字段。\n请重新运行 /opsx:verify。`,
    };
  }

  // git HEAD 获取失败 → fail-closed
  const currentCommit = getCurrentCommit();
  if (!currentCommit) {
    return {
      block: true,
      reason: `[VERIFY GATE] 归档被阻断：无法获取 git HEAD，无法验证 verify 结果是否过期。`,
    };
  }

  // commit 不匹配 → verify 已过期
  if (state.commit !== currentCommit) {
    return {
      block: true,
      reason: `[VERIFY GATE] 归档被阻断：verify 结果已过期（verify 后有新提交）。\n请重新运行 /opsx:verify。`,
    };
  }

  // warn 但用户未确认 → 阻断
  if (state.result === "warn" && !state.userConfirmed) {
    return {
      block: true,
      reason: `[VERIFY GATE] 归档被阻断：verify 有 warn 且用户未确认。\n请在 /opsx:verify 中显式确认后再归档。`,
    };
  }

  // --- change-scoped dirty worktree 检查 ---
  const dirtyResult = checkDirtyWorktree(changeName, changeDir, repoRoot);
  if (dirtyResult) {
    return dirtyResult;
  }

  return null; // 放行
}

/**
 * change-scoped dirty worktree 检查
 * 检查 change 相关的 tracked 文件是否有未提交修改
 *
 * @param {string} changeName - 变更名称
 * @param {string} changeDir - 变更目录绝对路径
 * @param {string} repoRoot - 仓库根目录
 * @returns {{ block: true, reason: string } | null}
 */
function checkDirtyWorktree(changeName, changeDir, repoRoot) {
  // 获取 git status
  let statusOutput;
  try {
    statusOutput = execSync("git status --porcelain", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
  } catch {
    // git status 失败 → fail-closed
    return {
      block: true,
      reason: `[VERIFY GATE] 归档被阻断：无法执行 git status，无法检查工作区状态。`,
    };
  }

  // 解析 tracked 文件变更（排除 untracked ??）
  const dirtyFiles = statusOutput
    .split("\n")
    .filter((line) => line.length >= 3 && !line.startsWith("??"))
    .map((line) => line.substring(3).trim())
    // 处理重命名 (R  old -> new)
    .map((f) => (f.includes(" -> ") ? f.split(" -> ")[1] : f));

  if (dirtyFiles.length === 0) {
    return null; // 无 dirty 文件，放行
  }

  // 尝试从 tasks.md 提取 change scope
  let allowedPaths = [];
  try {
    const tasksPath = path.join(changeDir, "tasks.md");
    const tasksContent = fs.readFileSync(tasksPath, "utf8");
    allowedPaths = extractPathsFromTasks(tasksContent);
  } catch {
    // tasks.md 不可读，fallback 为全 repo 检查
  }

  if (allowedPaths.length === 0) {
    // 无法确定 change scope → 检查全 repo：有任何 dirty tracked 文件就阻断
    return {
      block: true,
      reason:
        `[VERIFY GATE] 归档被阻断：工作区有未提交的修改。\n` +
        `请先提交或暂存修改，再归档变更「${changeName}」。\n` +
        `修改的文件：${dirtyFiles.slice(0, 5).join(", ")}${dirtyFiles.length > 5 ? " ..." : ""}`,
    };
  }

  // change-scoped 检查：只看与 allowedPaths 重叠的文件
  const scopedDirty = dirtyFiles.filter((f) => {
    const fDir = f.replace(/\/[^/]+$/, "");
    return allowedPaths.some(
      (p) => f === p || f.startsWith(p + "/") || (fDir !== f && (p === fDir || p.startsWith(fDir + "/")))
    );
  });

  if (scopedDirty.length > 0) {
    return {
      block: true,
      reason:
        `[VERIFY GATE] 归档被阻断：变更「${changeName}」相关文件有未提交的修改。\n` +
        `请先提交修改，再归档。\n` +
        `相关修改：${scopedDirty.slice(0, 5).join(", ")}${scopedDirty.length > 5 ? " ..." : ""}`,
    };
  }

  return null; // change 无关的修改不阻断
}

function getCurrentCommit() {
  try {
    return execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

module.exports = { checkVerifyGate, extractArchiveChangeName };
