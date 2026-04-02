// lib/bash_write_detector.js
// Bash 写操作检测：提取写入目标、判断是否为源文件写入、OpenSpec 路径安全检查

const path = require("path");

// 源文件扩展名和目录模式
const SOURCE_EXTENSIONS = /\.(js|ts|jsx|tsx|py|go|java|rb|rs|c|cpp|h|hpp|css|scss|html|vue|svelte|json|yaml|yml|toml|md|sh|sql)$/i;
const SOURCE_DIRS = /\b(src|lib|app|components|hooks|pages|routes|api|services|models|utils|scripts|test|tests|spec)\b/;

/**
 * 从 Bash 命令中提取所有写入目标路径
 * @param {string} cmd - Bash 命令
 * @returns {string[]} 写入目标列表
 */
function extractWriteTargets(cmd) {
  const targets = [];

  // 重定向目标 (> file, >> file, 1>file, 2>file)
  // 匹配所有重定向，后处理排除 fd-to-null、fd-to-fd
  for (const m of cmd.matchAll(/>{1,2}\s*(\S+)/g)) {
    const target = m[1];
    if (target.startsWith("&")) continue; // 排除 >&2、>&-  等 fd 复制
    if (/^\/dev\//.test(target)) continue; // 排除 >/dev/null 等
    targets.push(target);
  }

  // cp/mv 目标（最后一个参数）
  for (const op of ["cp", "mv"]) {
    const regex = new RegExp(`\\b${op}\\s+(.+?)(?:\\||;|&&|$)`);
    const match = regex.exec(cmd);
    if (match) {
      const parts = match[1].trim().split(/\s+/);
      if (parts.length > 0) targets.push(parts[parts.length - 1]);
    }
  }

  // tee 的所有目标文件（排除 flag 参数）
  const teeMatch = cmd.match(/\btee\s+(.+?)(?:\||$)/);
  if (teeMatch) {
    teeMatch[1].trim().split(/\s+/).filter(t => !t.startsWith("-")).forEach(t => targets.push(t));
  }

  // touch 目标
  const touchMatch = cmd.match(/\btouch\s+(.+?)(?:\||;|&&|$)/);
  if (touchMatch) {
    const firstTarget = touchMatch[1].trim().split(/\s+/)[0];
    if (firstTarget) targets.push(firstTarget);
  }

  // dd of=<path> 目标
  const ddMatch = cmd.match(/\bdd\b.*?\bof=(\S+)/);
  if (ddMatch) targets.push(ddMatch[1]);

  // curl -o / --output 目标
  for (const m of cmd.matchAll(/\bcurl\b.*?(?:-o|--output)\s+(\S+)/g)) {
    targets.push(m[1]);
  }

  // wget -O / --output-document 目标
  for (const m of cmd.matchAll(/\bwget\b.*?(?:-O|--output-document)\s+(\S+)/g)) {
    targets.push(m[1]);
  }

  // rsync 目标（最后一个参数，类似 cp）
  const rsyncMatch = cmd.match(/\brsync\s+(.+?)(?:\||;|&&|$)/);
  if (rsyncMatch) {
    const parts = rsyncMatch[1].trim().split(/\s+/).filter(p => !p.startsWith("-"));
    if (parts.length > 0) targets.push(parts[parts.length - 1]);
  }

  // install 目标（要求 install 为独立命令，排除路径中的子串和包管理器前缀）
  const installMatch = cmd.match(/(?:^|[|;&]\s*)(?!npm|pip|pip3|brew|apt|apt-get|yum|gem|cargo|pnpm|bun)\binstall\s+(.+?)(?:\||;|&&|$)/);
  if (installMatch) {
    const parts = installMatch[1].trim().split(/\s+/).filter(p => !p.startsWith("-"));
    if (parts.length > 0) targets.push(parts[parts.length - 1]);
  }

  return targets;
}

/**
 * 判断目标路径是否为源文件
 * @param {string} target - 文件路径
 * @returns {boolean}
 */
function isSourceTarget(target) {
  if (!target) return false;
  if (/^\/tmp\//.test(target) || /^\/dev\//.test(target)) return false;
  return SOURCE_EXTENSIONS.test(target) || SOURCE_DIRS.test(target);
}

/**
 * 判断 Bash 命令是否为写操作（写入源文件）
 * @param {string} cmd - Bash 命令
 * @returns {boolean}
 */
// 写操作关键词（用于子 shell / 脚本解释器的保守检测）
// 拆分为两类：shell 重定向 vs 代码级写 API
const REDIRECT_WRITE_INDICATOR = /(?<![0-9])>{1,2}/;
const CODE_WRITE_INDICATOR = /\bwrite\w*\(|\bopen\s*\(|\bfs[.'"]|\bwriteFile/;

function isBashWriteCommand(cmd) {
  // git 命令豁免：纯 git 操作不属于源文件写入
  // 仅当命令只包含 git 子命令时豁免；git 链接其他命令（&&、;、|、>）时继续检测
  if (/^\s*git\s/.test(cmd) && !/[;&|>]/.test(cmd)) return false;

  // gh/glab CLI 豁免：GitHub/GitLab CLI 操作与远程 API 交互，不写入项目源文件
  if (/^\s*(?:gh|glab)\s/.test(cmd)) return false;

  // sed -i（就地编辑）始终视为写操作
  if (/\bsed\s+(-[a-zA-Z]*i|--in-place)/.test(cmd)) return true;

  // patch 始终视为写操作（目标在 diff 文件内部，无法从命令行提取）
  if (/\bpatch\b/.test(cmd)) return true;

  // tar 提取模式视为写操作（创建模式不算）
  if (/\btar\s+.*(-x|--extract|x[a-zA-Z]*f)\b|\btar\s+x/.test(cmd)) return true;

  // 子 shell 模式：bash -c / sh -c / eval + 写关键词
  if (/\b(?:bash|sh)\s+-c\s/.test(cmd) || /\beval\s/.test(cmd)) {
    const hasRedirect = REDIRECT_WRITE_INDICATOR.test(cmd);
    const hasCodeWrite = CODE_WRITE_INDICATOR.test(cmd);
    if (hasRedirect || hasCodeWrite) {
      const targets = extractWriteTargets(cmd);
      if (targets.length === 0) {
        // 无法提取目标：仅在检测到代码级写 API 时保守判定
        if (hasCodeWrite) return true;
        // 仅有 shell 重定向（如 2>/dev/null）且提不到目标，不判写
      } else if (targets.some(t => isSourceTarget(t))) {
        return true;
      }
      // 有目标但都不是源文件，不判定为写操作
    }
  }

  // 脚本解释器模式：python -c / node -e / ruby -e / perl -e + 写关键词
  if (/\b(?:python3?|node|ruby|perl)\s+-[ce]\b/.test(cmd)) {
    const hasRedirect = REDIRECT_WRITE_INDICATOR.test(cmd);
    const hasCodeWrite = CODE_WRITE_INDICATOR.test(cmd);
    if (hasRedirect || hasCodeWrite) {
      const targets = extractWriteTargets(cmd);
      if (targets.length === 0) {
        if (hasCodeWrite) return true;
      } else if (targets.some(t => isSourceTarget(t))) {
        return true;
      }
    }
  }

  // 检查提取的写入目标是否包含源文件
  const targets = extractWriteTargets(cmd);
  return targets.some(t => isSourceTarget(t));
}

/**
 * 检查命令中是否有写入目标不在 openspec/ 目录下
 * 使用 path.resolve + path.relative 防止路径遍历绕过（如 openspec/../src/hack.js）
 * @param {string} cmd - Bash 命令
 * @param {string} repoRoot - 项目根目录
 * @returns {boolean} true 表示有目标不在 openspec/ 下
 */
function hasNonOpenSpecWriteTarget(cmd, repoRoot) {
  const targets = extractWriteTargets(cmd);
  return targets.some(t => {
    const resolved = path.resolve(repoRoot, t);
    const rel = path.relative(repoRoot, resolved);
    return !(rel.startsWith("openspec" + path.sep) || rel === "openspec");
  });
}

module.exports = {
  SOURCE_EXTENSIONS,
  SOURCE_DIRS,
  extractWriteTargets,
  isSourceTarget,
  isBashWriteCommand,
  hasNonOpenSpecWriteTarget,
};
