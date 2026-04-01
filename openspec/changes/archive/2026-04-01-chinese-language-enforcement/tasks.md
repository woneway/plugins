## 1. SessionStart 语言提醒

- [x] 1.1 在 `common-dev/hooks/session_start.js` 的 `parts` 数组开头插入语言规则：`"语言：始终用中文回复，代码和技术标识符保持英文。"`

## 2. Repo 外路径放行

- [x] 2.1 在 `common-dev/hooks/pre_tool_use.js` 步骤 2（`isWriteOperation` 判断）之后、步骤 3（OpenSpec 路径白名单）之前，增加 repo 外路径放行：用 `path.relative(repoRoot, filePath)` 判断目标是否在 repoRoot 内，不在则 `process.exit(0)`
- [x] 2.2 确认 API Key 检查（步骤 1b）在放行判断之前执行，不受影响

## 3. Bash 写操作误提取清理

- [x] 3.1 修改 `common-dev/hooks/lib/bash_write_detector.js` 的 `extractWriteTargets()` 重定向正则，排除 `2>/dev/null`、`2>&1` 等 fd 重定向模式（防御性改进，非拦截 bug 修复）

## 4. 测试

- [x] 4.1 在 `common-dev/hooks/__tests__/pre_tool_use.test.js` 中增加 repo 外路径放行的测试用例（`~/.claude/`、`~/.gstack/`、`~/.codex/`）
- [x] 4.2 在现有 bash_write_detector 测试中增加 `2>/dev/null` 不被误提取的测试用例
- [x] 4.3 运行全部测试确认无回归
