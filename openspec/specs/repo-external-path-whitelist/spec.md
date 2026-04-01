## ADDED Requirements

### Requirement: repo 外路径写入放行
`pre_tool_use.js` SHALL 对 Write/Edit/MultiEdit/NotebookEdit 工具写入 `repoRoot` 外路径的文件跳过 OpenSpec 门禁检查，直接放行。判断方式为 `path.relative(repoRoot, filePath)` 结果以 `..` 开头或为绝对路径。

#### Scenario: 写入 ~/.claude/ memory 文件不被拦截
- **WHEN** Write 工具写入 `/Users/lianwu/.claude/projects/-Users-lianwu-ai-plugins/memory/feedback_language.md`
- **THEN** hook SHALL 放行（exit 0），不触发 OpenSpec 工作流门禁

#### Scenario: 写入 ~/.gstack/ 数据文件不被拦截
- **WHEN** Write 工具写入 `~/.gstack/data/some-file.json`
- **THEN** hook SHALL 放行（exit 0）

#### Scenario: 写入 ~/.codex/ 文件不被拦截
- **WHEN** Edit 工具修改 `~/.codex/settings.json`
- **THEN** hook SHALL 放行（exit 0）

### Requirement: 项目内路径不受放行影响
repo 外路径放行 SHALL 不影响项目内路径的 OpenSpec 门禁逻辑。

#### Scenario: 项目内源文件仍被门禁拦截
- **WHEN** 无活跃 OpenSpec 变更，且 Write 工具写入 `src/index.js`（位于 repoRoot 内）
- **THEN** hook SHALL 触发 OpenSpec 工作流门禁拦截

### Requirement: API Key 检查不受放行影响
repo 外路径放行 SHALL 仅跳过 OpenSpec 门禁检查。API Key 内容检查（步骤 1b）SHALL 在放行判断之前执行，对所有路径生效。

#### Scenario: repo 外路径写入含 API Key 仍被拦截
- **WHEN** Write 工具写入 `/Users/lianwu/.claude/some-config.js`，内容包含疑似 API Key
- **THEN** hook SHALL 触发 API Key 安全拦截
