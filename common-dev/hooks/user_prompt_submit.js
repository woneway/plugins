#!/usr/bin/env node
// UserPromptSubmit: 意图分类 + 阶段感知引导
// 检测编码意图后，根据 OpenSpec 状态 + 三层架构引导下一步

const fs = require("fs");
const { getOpenSpecState } = require("./lib/openspec");

// --- 意图分类 ---

const CODING_KEYWORDS_ZH = [
  "实现", "修改", "新增", "删除", "重构", "添加", "更新", "修复",
  "写代码", "写一个", "建一个", "改一下", "加一个", "去掉", "移除",
  "创建文件", "编辑", "改动", "调整代码", "优化代码",
];

const CODING_KEYWORDS_EN = [
  "implement", "modify", "add", "delete", "remove", "refactor",
  "update", "fix", "create", "write", "change", "edit",
  "build", "develop", "code", "patch", "rewrite",
];

const NEGATION_PATTERNS = [
  /不要.{0,4}(修改|改|写|动)/,
  /只是.{0,4}(问|看|了解|解释|说明)/,
  /don'?t\s+(change|modify|edit|write)/i,
  /just\s+(explain|show|describe|read|look)/i,
];

const OPSX_PATTERN = /\/opsx:/;

function hasCodingIntent(prompt) {
  if (!prompt || typeof prompt !== "string") return false;

  // /opsx: 命令本身不算编码意图（由 OpenSpec 工作流自行管理）
  if (OPSX_PATTERN.test(prompt)) return false;

  const lower = prompt.toLowerCase();

  // 否定模式优先
  for (const neg of NEGATION_PATTERNS) {
    if (neg.test(prompt)) return false;
  }

  for (const kw of CODING_KEYWORDS_ZH) {
    if (prompt.includes(kw)) return true;
  }

  for (const kw of CODING_KEYWORDS_EN) {
    if (lower.includes(kw)) return true;
  }

  return false;
}

// --- 主逻辑 ---

let data;
try {
  data = JSON.parse(fs.readFileSync("/dev/stdin", "utf8"));
} catch {
  process.exit(0);
}

const prompt = data.prompt ?? "";

if (!hasCodingIntent(prompt)) {
  process.exit(0);
}

const { getRepoRoot } = require("./lib/repo_root");
const repoRoot = getRepoRoot();
const spec = getOpenSpecState(repoRoot);

let additionalContext = "";

if (spec.state === "not_initialized") {
  additionalContext =
    "检测到编码请求，但项目未初始化 OpenSpec。\n" +
    "建议运行 openspec init 启用变更管理，之后所有代码变更将通过 OpenSpec 工作流。\n" +
    "当前状态：未拦截（兼容模式）。";
} else if (spec.state === "no_active_change") {
  additionalContext =
    "检测到编码请求。当前无活跃的 OpenSpec 变更。\n" +
    "请先创建变更（hook 会阻断直接的代码修改）：\n" +
    "\n" +
    "快速路径（小改动）：\n" +
    "  /opsx:new <name> → /opsx:ff → /opsx:apply\n" +
    "\n" +
    "完整路径（新功能）：\n" +
    "  /office-hours → 理解需求，产出 design doc\n" +
    "  /opsx:new <name> → 引用 design doc 创建变更\n" +
    "  /opsx:ff → 生成规划（推荐用 code-explorer 探索代码）\n" +
    "  /opsx:apply → 逐条实施";
} else if (spec.state === "planning") {
  additionalContext =
    `当前变更（${spec.allChanges.join(", ")}）尚在规划阶段，tasks.md 未就绪。\n` +
    "请先完成规划（hook 会阻断代码写入）：\n" +
    "  /opsx:ff       → 生成所有规划文档（含 tasks.md）\n" +
    "  /opsx:continue → 逐步生成下一个 artifact\n" +
    "\n" +
    "推荐：在生成 specs 前用 Explore agent 探索相关代码，\n" +
    "     用 Plan agent 辅助架构设计。\n" +
    "\n" +
    "tasks.md 就绪后再运行 /opsx:apply 实施代码。";
} else if (spec.state === "ready_to_apply") {
  const readyPart = `可实施变更：${spec.changes.join(", ")}（tasks.md 已就绪）`;
  const planningPart = spec.planningChanges.length > 0
    ? `\n仍在规划中：${spec.planningChanges.join(", ")}（需先运行 /opsx:ff 生成 tasks.md）`
    : "";
  additionalContext =
    `当前活跃变更：${spec.allChanges.join(", ")}\n` +
    readyPart + planningPart + "\n" +
    "请通过 /opsx:apply 按 tasks.md 逐条实施。\n" +
    "\n" +
    "推荐：每个 task 先用 tdd-guide agent 写测试，再实现代码。\n" +
    "实施完成后用 /review + security-reviewer 审查。";
}

if (additionalContext) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext,
      },
    })
  );
}

process.exit(0);
