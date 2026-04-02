## Context

CLAUDE.md 是 Claude Code 在进入项目时读取的上下文文件。当前内容只有 skill routing 规则（已由 session-start hook 覆盖，属于冗余），对在此 repo 工作的 AI 没有实质帮助。

## Goals / Non-Goals

**Goals:**
- 让 CLAUDE.md 传达项目目标和设计哲学
- 提供架构概览，帮助 AI 在做工程决策时有正确的 mental model
- 提供开发规范（Commands、测试、reinstall）

**Non-Goals:**
- 不替代 README（README 面向人类用户）
- 不重复 hook 已注入的 skill routing 规则
- 不覆盖各子模块的具体实现细节

## Decisions

**决策：CLAUDE.md 以项目目标开头，而非操作规则**

原因：AI 在 session 开始时读取 CLAUDE.md，如果第一段是"这是 harness engineering 项目"，后续所有决策都会在正确框架下进行。操作规则（如 Commands）放在后面作为参考。

**决策：保留 Commands 章节**

原因：reinstall 命令不直觉，AI 容易猜错路径。显式列出可防止 hallucination。

## Risks / Trade-offs

- [风险] 内容过长导致 AI 读取时超出 context → 保持精简，每节不超过 5 行
