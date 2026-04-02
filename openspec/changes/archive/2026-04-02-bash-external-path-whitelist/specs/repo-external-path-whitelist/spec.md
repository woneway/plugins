## ADDED Requirements

### Requirement: Bash 写入 repo 外路径放行

`pre_tool_use.js` SHALL 对 Bash 工具的写操作检查写入目标路径。当 `extractWriteTargets()` 提取到的所有写入目标都在 `repoRoot` 外时，SHALL 跳过 OpenSpec 门禁检查，直接放行。

#### Scenario: Bash touch ~/.gstack/ 不被拦截

- **WHEN** Bash 命令为 `touch ~/.gstack/sessions/12345`
- **THEN** hook SHALL 放行（exit 0），不触发 OpenSpec 工作流门禁

#### Scenario: Bash echo >> ~/.gstack/analytics/ 不被拦截

- **WHEN** Bash 命令为 `echo '{"skill":"ship"}' >> ~/.gstack/analytics/skill-usage.jsonl`
- **THEN** hook SHALL 放行（exit 0）

#### Scenario: Bash mkdir ~/.gstack/ 不被拦截

- **WHEN** Bash 命令为 `mkdir -p ~/.gstack/sessions`
- **THEN** hook SHALL 放行（exit 0）

#### Scenario: Bash 混合 repo 内外路径不放行

- **WHEN** Bash 命令为 `cp ~/.gstack/template.js src/new-file.js`
- **THEN** hook SHALL 不放行（`src/new-file.js` 在 repo 内）

#### Scenario: Bash 无法提取目标时不放行

- **WHEN** Bash 命令包含 eval 且无法提取写入目标（targets 为空）
- **THEN** hook SHALL 不放行（保守行为），走正常 OpenSpec 门禁流程

### Requirement: API Key 检查不受 Bash 外部路径放行影响

Bash 外部路径放行 SHALL 仅跳过 OpenSpec 门禁检查。API Key 检查（步骤 1）SHALL 在路径放行之前执行。

#### Scenario: Bash git commit 含 API Key 仍被拦截

- **WHEN** Bash 命令为 `git commit -m "add key"` 且 staged diff 包含疑似 API Key
- **THEN** hook SHALL 触发 API Key 安全拦截，不受路径放行影响
