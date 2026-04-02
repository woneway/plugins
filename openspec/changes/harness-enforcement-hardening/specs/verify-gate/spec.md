## MODIFIED Requirements

### Requirement: 扩展归档操作检测模式

`checkVerifyGate()` SHALL 除现有 `mv` 模式外，额外检测以下归档操作变体：

#### Scenario: cp + rm 组合归档
- **WHEN** bash 命令为 `cp -r openspec/changes/foo openspec/changes/archive/2026-01-01-foo && rm -rf openspec/changes/foo`
- **THEN** hook SHALL 提取 change 名 `foo` 并执行 verify 状态检查

#### Scenario: cp -a 变体
- **WHEN** bash 命令为 `cp -a openspec/changes/bar openspec/changes/archive/2026-01-01-bar`
- **THEN** hook SHALL 提取 change 名 `bar` 并执行 verify 状态检查

#### Scenario: rsync 归档变体
- **WHEN** bash 命令为 `rsync -a openspec/changes/baz/ openspec/changes/archive/2026-01-01-baz/`
- **THEN** hook SHALL 提取 change 名 `baz` 并执行 verify 状态检查

#### Scenario: 非归档 cp/mv 不受影响
- **WHEN** bash 命令为 `cp src/a.js src/b.js`
- **THEN** hook SHALL 返回 null（放行）

### Requirement: change-scoped dirty worktree 检查

`checkVerifyGate()` 在 commit hash 匹配后 SHALL 额外检查 worktree 中与当前 change 相关的文件是否有未提交变更。

#### Scenario: worktree 干净时放行
- **WHEN** verify 状态文件 commit 匹配当前 HEAD
- **AND** `git status --porcelain` 中无与 change allowedPaths 重叠的行
- **THEN** hook SHALL 放行

#### Scenario: change 相关文件有未提交变更时阻断
- **WHEN** verify 状态文件 commit 匹配当前 HEAD
- **AND** `git status --porcelain` 中有与 change allowedPaths 重叠的 tracked 文件变更
- **THEN** hook SHALL 阻断，提示 "verify 后 change 相关文件有未提交变更，请先提交或 stash 后重新运行 /opsx:verify"

#### Scenario: 仅有无关文件变更时放行
- **WHEN** `git status --porcelain` 输出非空
- **AND** 所有变更行对应的文件不在 change 的 allowedPaths 范围内
- **THEN** hook SHALL 放行

#### Scenario: 仅有 untracked 文件时放行
- **WHEN** `git status --porcelain` 输出仅包含 `??` 前缀行
- **THEN** hook SHALL 放行

#### Scenario: 无法确定 change scope 时退化为全 repo 检查
- **WHEN** 无法从 current-change 或 tasks.md 提取 allowedPaths
- **THEN** hook SHALL 退化为检查全部 tracked 文件变更（保守行为）

#### Scenario: git status 执行失败时 fail-closed
- **WHEN** `git status --porcelain` 执行失败
- **THEN** hook SHALL 阻断，提示 "无法检查 worktree 状态"
