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
  } catch (e) {
    process.stderr.write(`[WARN] openspec: state read failed - ${e.message}\n`);
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

/**
 * 从 tasks.md 内容中提取文件路径和目录前缀
 *
 * 提取规则：
 *   1. backtick 包裹的路径（含 / 的非 URL、非 openspec 路径）
 *   2. 含 / 且有文件扩展名的裸路径
 *   3. 上述路径的目录前缀
 *
 * @param {string} tasksContent - tasks.md 文件内容
 * @returns {string[]} 去重的路径列表（文件路径 + 目录前缀）
 */
function extractPathsFromTasks(tasksContent) {
  if (!tasksContent) return [];

  const filePaths = new Set();

  // 1. backtick 包裹的路径
  for (const match of tasksContent.matchAll(/`([^`\n]+)`/g)) {
    const candidate = match[1].trim();
    if (isExtractablePath(candidate)) {
      filePaths.add(candidate);
    }
  }

  // 2. 裸路径：含 / 且有扩展名的 token
  for (const match of tasksContent.matchAll(/(?:^|[\s(])([a-zA-Z0-9_.\-/]+\/[a-zA-Z0-9_.\-/]+\.\w+)(?=[\s,;:)}\]\n]|$)/gm)) {
    const candidate = match[1];
    if (isExtractablePath(candidate)) {
      filePaths.add(candidate);
    }
  }

  // 3. 目录前缀
  const dirs = new Set();
  for (const p of filePaths) {
    const dir = p.replace(/\/[^/]+$/, "");
    if (dir && dir !== p && dir.length > 0) {
      dirs.add(dir);
    }
  }

  return [...filePaths, ...dirs];
}

function isExtractablePath(str) {
  if (!str || !str.includes("/")) return false;
  if (/^https?:\/\//.test(str)) return false;
  if (/^openspec\//.test(str)) return false;
  if (/\s/.test(str)) return false;
  return /^[a-zA-Z0-9_.\/\-]+$/.test(str);
}

module.exports = { getOpenSpecState, isOpenSpecPath, extractPathsFromTasks };
