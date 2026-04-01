## ADDED Requirements

### Requirement: SessionStart 注入中文语言提醒
`session_start.js` 的 `additionalContext` 输出 SHALL 包含中文语言规则提示，内容为：`"语言：始终用中文回复，代码和技术标识符保持英文。"`

#### Scenario: 语言提醒出现在 additionalContext 中
- **WHEN** SessionStart hook 执行
- **THEN** 输出的 `additionalContext` SHALL 包含 `"语言：始终用中文回复，代码和技术标识符保持英文。"`

### Requirement: 语言提醒位于输出开头
语言规则 SHALL 作为 `parts` 数组的第一个元素插入，确保在 `additionalContext` 输出中处于最前位置。

#### Scenario: 语言提醒排在其他内容之前
- **WHEN** SessionStart hook 执行并输出多条提示
- **THEN** 语言规则 SHALL 出现在 gstack 状态、OpenSpec 状态等内容之前
