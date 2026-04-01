#!/usr/bin/env node
// SessionStart: 统一工作流提示 + OpenSpec 初始化检测

const { existsSync } = require("fs");
const { join } = require("path");
const os = require("os");

const gstackOk = [
  join(os.homedir(), ".claude/skills/office-hours"),
  join(os.homedir(), ".codex/skills/office-hours"),
].some((dir) => existsSync(dir));
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT ?? process.env.CODEX_PLUGIN_ROOT ?? "";
const repoRoot = process.cwd();
const hasOpenSpec = existsSync(join(repoRoot, "openspec"));

// --- 构建上下文 ---

const parts = [];

// 语言
parts.push("语言：始终用中文回复，代码和技术标识符保持英文。");

// gstack 状态
if (gstackOk) {
  parts.push("产品层：/office-hours → /plan-eng-review → /ship → /retro");
} else {
  const setupCmd = pluginRoot ? `node ${pluginRoot}/scripts/setup.js` : "运行插件内 scripts/setup.js";
  parts.push(`gstack 未安装，请运行：${setupCmd}`);
}

// OpenSpec 状态
if (hasOpenSpec) {
  parts.push("变更管理层（hook 强制）：/opsx:new → /opsx:ff → /opsx:apply → /opsx:archive");
} else {
  parts.push(
    "变更管理层：OpenSpec 未初始化。建议运行 openspec init 启用变更管理。\n" +
    "未初始化时代码写入不受拦截（兼容模式）。"
  );
}

// 工程质量层
parts.push("工程质量层：tdd-guide, security-reviewer, /review, /cso, /qa");

// OPENSPEC_SKIP 紧急豁免检测
if (process.env.OPENSPEC_SKIP === "1") {
  parts.push("⚠ 紧急豁免模式（OPENSPEC_SKIP=1）：代码写入不受门禁拦截，操作将被记录。");
}

// Skill 自动路由
if (gstackOk) {
  parts.push(
    "Skill 自动路由（匹配时直接调用 Skill tool，不要先回答）：\n" +
    "- 产品想法、\"值不值得做\"、头脑风暴 → invoke office-hours\n" +
    "- Bug、报错、\"为什么挂了\" → invoke investigate\n" +
    "- Ship、部署、推代码、创建 PR → invoke ship\n" +
    "- QA、测试站点、找 bug → invoke qa\n" +
    "- 代码审查、看 diff → invoke review\n" +
    "- 发布后更新文档 → invoke document-release\n" +
    "- 周报、retro → invoke retro\n" +
    "- 设计系统、品牌 → invoke design-consultation\n" +
    "- 视觉审查、设计打磨 → invoke design-review\n" +
    "- 架构审查 → invoke plan-eng-review"
  );
}

// 安全
parts.push("安全提醒：禁止硬编码 API Key，有 hook 自动拦截 git commit。");

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: parts.join("\n\n"),
  },
}));
