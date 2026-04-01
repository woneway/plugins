## Why

两个问题需要一起修复：

1. **语言遗忘**：安装了 `common-dev` plugin 的项目，AI 经常忘记使用中文回复。虽然 `CLAUDE.md` 已有规则，但 AI 可能在长对话中遗忘。需要在 SessionStart hook 中注入语言提醒作为双层保障。

2. **Hook 过度拦截**：Write/Edit 工具写入项目外路径（如 `~/.claude/projects/.../memory/`）被 OpenSpec 门禁错误拦截——这些不是项目代码变更，不应受门禁管控。

## What Changes

- 在 `session_start.js` 的 `additionalContext` 输出中增加中文语言规则
- 在 `pre_tool_use.js` 中增加 repo 外路径放行：Write/Edit 目标不在 `repoRoot` 内时直接跳过 OpenSpec 门禁
- 清理 `extractWriteTargets()` 中 fd 重定向（`2>/dev/null`）的误提取（注：这不是已证实的拦截 bug，`isSourceTarget()` 已正确排除 `/dev/` 路径，此改动仅清理中间提取逻辑）

## Capabilities

### New Capabilities

- `session-language-hint`: SessionStart hook 注入语言偏好提醒，确保 AI 在每个会话中都用中文回复
- `repo-external-path-whitelist`: Write/Edit 目标在 repoRoot 外时跳过 OpenSpec 门禁检查（覆盖 `~/.claude/`、`~/.gstack/`、`~/.codex/` 及任何 repo 外路径）

### Modified Capabilities

- `bash-write-detection-v2`: 清理 `extractWriteTargets()` 对 fd 重定向（`2>/dev/null`、`2>&1`）的误提取（防御性改进，非拦截 bug 修复）

## Impact

- 修改文件：`common-dev/hooks/session_start.js`、`common-dev/hooks/pre_tool_use.js`、`common-dev/hooks/lib/bash_write_detector.js`
- 影响范围：所有安装了 `common-dev` plugin 的项目
- 无破坏性变更
