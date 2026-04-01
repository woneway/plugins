#!/usr/bin/env node
// 共享模块：OpenSpec 状态检测
// 被 pre_tool_use.js 和 user_prompt_submit.js 共同使用

const fs = require("fs");
const path = require("path");

/**
 * 检测当前项目的 OpenSpec 工作流状态
 * @param {string} repoRoot - 项目根目录（通常是 process.cwd()）
 * @returns {{ state: string, changes?: string[] }}
 *
 * 状态说明：
 *   not_initialized — 项目未运行 openspec init，放行（兼容模式）
 *   no_active_change — 无活跃变更，阻断代码写入
 *   planning — 有变更但 tasks.md 未生成，阻断代码写入
 *   ready_to_apply — 有活跃变更且有 tasks.md，放行
 */
function getOpenSpecState(repoRoot) {
  try {
    const changesDir = path.join(repoRoot, "openspec/changes");
    if (!fs.existsSync(changesDir)) return { state: "not_initialized" };

    const entries = fs.readdirSync(changesDir, { withFileTypes: true });
    const activeChanges = entries
      .filter((e) => e.isDirectory() && e.name !== "archive")
      .map((e) => ({
        name: e.name,
        hasTasks: fs.existsSync(path.join(changesDir, e.name, "tasks.md")),
      }));

    if (activeChanges.length === 0) return { state: "no_active_change" };

    const allNames = activeChanges.map((c) => c.name);
    const readyToApply = activeChanges.filter((c) => c.hasTasks);
    const planningOnly = activeChanges.filter((c) => !c.hasTasks);

    if (readyToApply.length === 0) {
      return {
        state: "planning",
        changes: allNames,
        allChanges: allNames,
        planningChanges: allNames,
      };
    }

    return {
      state: "ready_to_apply",
      changes: readyToApply.map((c) => c.name),
      allChanges: allNames,
      planningChanges: planningOnly.map((c) => c.name),
    };
  } catch {
    // fail open：意外错误时不阻断操作
    return { state: "not_initialized" };
  }
}

/**
 * 检测路径是否在 openspec/ 白名单内
 * OpenSpec 自身的 artifact 写入（proposal.md, specs/, tasks.md 等）不受门禁限制
 */
function isOpenSpecPath(filePath, repoRoot) {
  if (!filePath) return false;
  const rel = path.relative(repoRoot, path.resolve(repoRoot, filePath));
  return rel.startsWith("openspec" + path.sep) || rel === "openspec";
}

module.exports = { getOpenSpecState, isOpenSpecPath };
