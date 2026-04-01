## Context

`common-dev` plugin 通过两个机制向 AI 传递指令：
1. `CLAUDE.md` — 作为 system-reminder 加载，包含语言规则
2. `session_start.js` — 通过 `additionalContext` 在会话开头注入上下文

`pre_tool_use.js` 是写操作门禁，当前逻辑：
1. API Key 检查
2. 判断是否写操作（`isWriteOperation()`）
3. OpenSpec 路径白名单（仅 `openspec/` 目录）
4. OPENSPEC_SKIP 豁免
5. OpenSpec 工作流门禁

问题：步骤 2 之后直接跳到步骤 3，缺少对「repo 外路径」的放行。Write/Edit 写入 `~/.claude/.../memory/` 等路径时，因不在 `openspec/` 白名单内而被门禁拦截。

## Goals / Non-Goals

**Goals:**
- SessionStart 注入中文语言提醒
- Write/Edit 写入 repoRoot 外路径时跳过 OpenSpec 门禁（覆盖 `~/.claude/`、`~/.gstack/`、`~/.codex/` 及任何 repo 外路径）
- 清理 `extractWriteTargets()` 对 `2>/dev/null` 的中间误提取（防御性改进）

**Non-Goals:**
- 不重构整个 hook 架构
- 不做多语言支持
- 不修改 API Key 检查逻辑

## Decisions

### 1. 语言提醒放在 `parts` 数组开头

将 `"语言：始终用中文回复，代码和技术标识符保持英文。"` 插入为第一条。理由：最重要的规则最先出现，不易被截断。

### 2. repo 外路径统一放行（而非硬编码白名单目录）

对 Write/Edit/MultiEdit/NotebookEdit，用 `path.relative(repoRoot, filePath)` 检查目标是否在 `repoRoot` 内。如果路径以 `..` 开头或是绝对路径且不在 repoRoot 下，直接 `process.exit(0)` 放行。

**放弃方案**：硬编码 `~/.claude/` + `~/.gstack/` 白名单。理由：
- 插件已兼容 Claude 和 Codex（`session_start.js` 识别 `~/.codex/`），硬编码会遗漏
- 将来新增工具链目录需要手动维护
- OpenSpec 门禁的本质是管控项目代码变更，repo 外文件天然不属于管控范围

放在步骤 2 之后、步骤 3（OpenSpec 路径白名单）之前。

### 3. 清理 fd 重定向误提取（防御性改进）

当前 `extractWriteTargets()` 的重定向正则 `/>{1,2}\s*(\S+)/g` 会匹配 `2>/dev/null` 并提取 `/dev/null`。虽然 `isSourceTarget()` 会排除 `/dev/` 路径（所以不会造成实际拦截），但从正确性角度应在提取阶段就排除 fd 重定向模式。

改进正则：排除 `数字>/dev/null` 和 `数字>&数字` 模式。

## Risks / Trade-offs

- [风险] repo 外路径统一放行范围较广 → 可接受，OpenSpec 门禁目的是管控项目代码，repo 外文件不属于管控范围。API Key 检查在放行之前执行，不受影响
- [风险] 重定向正则改动可能遗漏边界情况 → 通过现有测试 + 新增测试覆盖
- [权衡] 语言双层提醒有冗余 → 可接受，冗余提高可靠性
