// lib/api_key_check.js
// API Key / Secret 硬编码检测

// 原有模式：环境变量赋值
const ENV_VAR_PATTERN = /(_KEY|_TOKEN|_SECRET|_PASSWORD)\s*=\s*["'][A-Za-z0-9_\-]{16,}["']/i;

// 已知密钥前缀（逐行列出，便于维护）
// 注意：不包含 pk_live_（Stripe publishable key，设计为公开在前端）
// 注意：不包含 sk_test_（Stripe test key，安全可提交）
const KNOWN_PREFIXES = [
  "sk-[A-Za-z0-9]{20,}",             // OpenAI
  "ghp_[A-Za-z0-9]{36,}",            // GitHub PAT
  "gho_[A-Za-z0-9]{36,}",            // GitHub OAuth
  "AKIA[A-Z0-9]{16}",                // AWS Access Key
  "sk_live_[A-Za-z0-9]{24,}",        // Stripe Secret Key
  "rk_live_[A-Za-z0-9]{24,}",        // Stripe Restricted Key
  "xoxb-[A-Za-z0-9\\-]{24,}",        // Slack Bot Token
  "xoxp-[A-Za-z0-9\\-]{24,}",        // Slack User Token
  "AIza[A-Za-z0-9_\\-]{35}",         // Google API Key
  "npm_[A-Za-z0-9]{36,}",            // npm Token
];
const KNOWN_PREFIX_PATTERN = new RegExp("(" + KNOWN_PREFIXES.join("|") + ")");

// Bearer token header
const BEARER_PATTERN = /["']Bearer\s+[A-Za-z0-9_\-\.]{20,}["']/i;

const ALL_PATTERNS = [ENV_VAR_PATTERN, KNOWN_PREFIX_PATTERN, BEARER_PATTERN];

/**
 * 判断一行是否应被排除（.example 文件引用、注释行）
 */
function isExcludedLine(line) {
  if (line.includes(".example")) return true;
  if (/^\+\s*#/.test(line)) return true;     // diff 中的注释行
  if (/^\s*#/.test(line)) return true;        // 普通注释行
  if (/^\s*\/\//.test(line)) return true;     // JS 注释行
  return false;
}

/**
 * 检查 git diff 输出中是否包含硬编码 API Key
 * @param {string} diff - git diff --cached 的输出
 * @returns {{ found: boolean, count: number }}
 */
function checkApiKeyInDiff(diff) {
  if (!diff) return { found: false, count: 0 };

  const hits = diff
    .split("\n")
    .filter(l => l.startsWith("+") && !l.startsWith("+++"))
    .filter(l => !isExcludedLine(l))
    .filter(l => ALL_PATTERNS.some(p => p.test(l)));

  return { found: hits.length > 0, count: hits.length };
}

/**
 * 检查任意文本内容中是否包含硬编码 API Key
 * @param {string} content - 文件内容或代码片段
 * @returns {{ found: boolean, count: number }}
 */
function checkApiKeyInContent(content) {
  if (!content) return { found: false, count: 0 };

  const hits = content
    .split("\n")
    .filter(l => !isExcludedLine(l))
    .filter(l => ALL_PATTERNS.some(p => p.test(l)));

  return { found: hits.length > 0, count: hits.length };
}

module.exports = {
  checkApiKeyInDiff,
  checkApiKeyInContent,
};
