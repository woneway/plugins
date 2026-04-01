## MODIFIED Requirements

### Requirement: /tmp and /dev exclusions preserved
`extractWriteTargets` SHALL 在提取阶段排除 fd 重定向模式（如 `2>/dev/null`、`2>&1`），不将其作为写入目标提取。这是防御性改进——当前 `isSourceTarget()` 已正确排除 `/dev/` 路径，此改动使中间提取结果更准确。所有新旧提取模式 SHALL 继续排除 `/tmp/` 和 `/dev/` 路径。

#### Scenario: 2>/dev/null 不被提取为写入目标
- **WHEN** command 是 `_UPD=$(~/.claude/skills/gstack/bin/gstack-update-check 2>/dev/null || true)`
- **THEN** `extractWriteTargets` SHALL 返回空列表

#### Scenario: 2>&1 不被提取为写入目标
- **WHEN** command 是 `some-command 2>&1 | grep error`
- **THEN** `extractWriteTargets` SHALL 不包含 `&1`

#### Scenario: 标准输出重定向仍被检测
- **WHEN** command 是 `echo "data" > src/config.js`
- **THEN** `extractWriteTargets` SHALL 返回包含 `src/config.js` 的列表

#### Scenario: curl to /tmp not flagged
- **WHEN** command 是 `curl -o /tmp/download.json https://example.com`
- **THEN** `isBashWriteCommand` SHALL 返回 `false`
