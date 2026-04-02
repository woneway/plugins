// tdd_gate.js — 实现文件写操作前强制要求对应测试文件存在
//
// 仅在 OpenSpec 状态为 ready_to_apply 时激活。
// 白名单文件（测试文件、配置、文档、资源）不受约束。
// TDD_SKIP=1 环境变量可豁免，但会记录日志。

const fs = require("fs");
const path = require("path");

// 白名单模式：这些文件不需要对应测试
const WHITELIST_PATTERNS = [
  // 测试文件本身
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /__tests__\//,
  // 配置文件
  /^\.?[a-z].*\.config\.[jt]s$/,  // jest.config.js, babel.config.ts, etc.
  /\.config\.[jt]sx?$/,
  /^\.eslintrc/,
  /^\.prettierrc/,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^tsconfig.*\.json$/,
  // 文档
  /\.md$/,
  // 资源文件
  /\.ya?ml$/,
  /\.json$/,
  /\.d\.ts$/,
  /\.ipynb$/,
  // bin 入口
  /^bin\//,
];

/**
 * 检查文件路径是否在白名单中（不需要测试的文件类型）
 */
function isWhitelisted(filePath) {
  const basename = path.basename(filePath);
  const normalized = filePath.replace(/\\/g, "/");
  return WHITELIST_PATTERNS.some(
    (pattern) => pattern.test(basename) || pattern.test(normalized)
  );
}

/**
 * 查找实现文件对应的测试文件是否存在
 * 搜索顺序：
 *   1. <dir>/__tests__/<name>.test.js
 *   2. <dir>/<name>.test.js
 *   3. <dir>/<name>.spec.js
 */
function hasTestFile(filePath, repoRoot) {
  const absPath = path.resolve(repoRoot, filePath);
  const dir = path.dirname(absPath);
  const ext = path.extname(absPath);
  const name = path.basename(absPath, ext);

  const candidates = [
    path.join(dir, "__tests__", `${name}.test${ext}`),
    path.join(dir, `${name}.test${ext}`),
    path.join(dir, `${name}.spec${ext}`),
  ];

  return candidates.some((candidate) => fs.existsSync(candidate));
}

/**
 * TDD gate 主函数
 *
 * @param {string} filePath - 写操作目标的相对路径
 * @param {string} repoRoot - 仓库根目录
 * @param {string} openspecState - OpenSpec 状态机状态
 * @returns {{ block: true, reason: string } | null}
 */
function checkTddGate(filePath, repoRoot, openspecState) {
  // 仅在 ready_to_apply 状态激活
  if (openspecState !== "ready_to_apply") {
    return null;
  }

  // TDD_SKIP=1 豁免
  if (process.env.TDD_SKIP === "1") {
    try {
      const logDir = path.join(repoRoot, ".claude");
      fs.mkdirSync(logDir, { recursive: true });
      const logPath = path.join(logDir, "tdd-skip-log.jsonl");
      const entry = {
        timestamp: new Date().toISOString(),
        filePath,
      };
      fs.appendFileSync(logPath, JSON.stringify(entry) + "\n");
    } catch {
      // 日志写入失败不阻断
    }
    return null;
  }

  // 白名单文件放行
  if (isWhitelisted(filePath)) {
    return null;
  }

  // 检查对应测试文件是否存在
  if (hasTestFile(filePath, repoRoot)) {
    return null;
  }

  return {
    block: true,
    reason:
      `[TDD] 变更被阻断：文件 ${filePath} 没有对应的测试文件。\n` +
      `请先创建测试文件（如 __tests__/${path.basename(filePath, path.extname(filePath))}.test${path.extname(filePath)}），再编写实现代码。\n` +
      `提示：使用 tdd-guide agent 可以帮助你编写测试。`,
  };
}

module.exports = { checkTddGate, isWhitelisted, hasTestFile };
