// verify_gate.js — archive 前 verify 状态门禁
//
// 检测 bash 命令是否为 archive mv 操作，若是则检查对应变更的 verify 状态文件。
// 状态文件由 /opsx:verify skill 写入，包含 result、userConfirmed、commit、timestamp。
//
// 放行条件：
//   - 命令不是 archive mv 操作
//   - OPENSPEC_SKIP=1（紧急豁免）
//   - 状态文件存在、commit 匹配当前 HEAD、result=pass 或 (result=warn && userConfirmed=true)
//
// 阻断条件：
//   - 状态文件不存在（未运行 verify）
//   - commit 不匹配（verify 已过期）
//   - result=warn 且 userConfirmed=false（warn 未确认）

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// 匹配: mv openspec/changes/<name> openspec/changes/archive/...
const ARCHIVE_PATTERN =
  /\bmv\s+(openspec\/changes\/([^/\s]+))\s+openspec\/changes\/archive\//;

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

  const match = command.match(ARCHIVE_PATTERN);
  if (!match) {
    return null; // 非 archive 操作，放行
  }

  const changeName = match[2];
  const stateFile = path.join(
    repoRoot,
    "openspec",
    "changes",
    changeName,
    ".verify-state.json"
  );

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

  // commit 不匹配 → verify 已过期
  const currentCommit = getCurrentCommit();
  if (currentCommit && state.commit && state.commit !== currentCommit) {
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

  return null; // 放行
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

module.exports = { checkVerifyGate };
