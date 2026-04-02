## ADDED Requirements

### Requirement: verify 状态文件合约
`/opsx:verify` SHALL 在验证完成后将结果写入 `openspec/changes/<name>/.verify-state.json`。L1/L2 任一失败时 SHALL NOT 写入状态文件。L3/L4 产生 warn 时 SHALL 写入 `{result:"warn", userConfirmed:false}`。全部通过时 SHALL 写入 `{result:"pass", userConfirmed:true}`。状态文件 SHALL 包含运行时的 git commit hash。

#### Scenario: verify 全部通过
- **WHEN** L1/L2 通过且 L3/L4 无 warn
- **THEN** SHALL 写入 `{result:"pass", userConfirmed:true, commit:"<HEAD>", timestamp:"..."}`

#### Scenario: L1 失败时不写状态文件
- **WHEN** tasks.md 存在未完成 checkbox
- **THEN** verify SHALL NOT 写入状态文件，返回 fail 并列出未完成 task

#### Scenario: warn 时写未确认状态
- **WHEN** L3/L4 产生 warn（L1/L2 通过）
- **THEN** SHALL 写入 `{result:"warn", userConfirmed:false, commit:"<HEAD>"}`

#### Scenario: 用户确认 warn 后更新状态文件
- **WHEN** 用户在 verify 中显式选择"确认归档"
- **THEN** SHALL 将状态文件更新为 `{result:"warn", userConfirmed:true, commit:"<HEAD>"}`

### Requirement: hook 拦截 archive mv 命令
`lib/verify_gate.js` SHALL 检测 bash 命令是否匹配 archive 操作模式（`mv openspec/changes/<name> openspec/changes/archive/`），并检查对应变更的 verify 状态文件。

#### Scenario: 状态文件不存在时阻断
- **WHEN** bash 命令为 archive mv 且状态文件不存在
- **THEN** hook SHALL 阻断并提示"未运行 verify，请先执行 /opsx:verify"

#### Scenario: verify 已过期时阻断
- **WHEN** 状态文件存在但 commit hash 与当前 HEAD 不匹配
- **THEN** hook SHALL 阻断并提示"verify 结果已过期，请重新运行 /opsx:verify"

#### Scenario: warn 未确认时阻断
- **WHEN** 状态文件 result 为 warn 且 userConfirmed 为 false
- **THEN** hook SHALL 阻断并提示"verify 有 warn，需在 /opsx:verify 中显式确认后再 archive"

#### Scenario: verify pass 后放行
- **WHEN** 状态文件 result 为 pass 且 commit 匹配当前 HEAD
- **THEN** hook SHALL 放行 mv 命令

#### Scenario: warn 已确认时放行
- **WHEN** 状态文件 result 为 warn 且 userConfirmed 为 true 且 commit 匹配
- **THEN** hook SHALL 放行 mv 命令

#### Scenario: OPENSPEC_SKIP=1 豁免
- **WHEN** 环境变量 OPENSPEC_SKIP=1 存在
- **THEN** hook SHALL 放行 mv 命令，不检查状态文件

### Requirement: L1 客观检查——checkbox 完整且基于 change 的 diff 非空
verify SHALL 检查：(1) tasks.md 所有 checkbox 为 `[x]`；(2) 从 change 开始点到当前 HEAD 的 git diff 非空（非 working tree diff）。

#### Scenario: 基于 change 开始点计算 diff
- **WHEN** verify 运行时
- **THEN** diff 基准 SHALL 为 `git merge-base HEAD main`（或 `openspec/config.yaml` 中记录的 base commit）

#### Scenario: 存在未完成 task
- **WHEN** tasks.md 中存在 `- [ ]` 项
- **THEN** L1 SHALL 返回 fail，列出未完成 task，不写状态文件

#### Scenario: diff 为空
- **WHEN** change 开始点到 HEAD 的 diff 为空
- **THEN** L1 SHALL 返回 fail，提示"无实际代码变更"，不写状态文件

### Requirement: L2 客观检查——项目定义的验证命令通过
verify SHALL 按优先级查找验证命令：(1) `openspec/config.yaml` 的 `verify_command` 字段；(2) `package.json` scripts.test（非空且非 `echo`）。找到则运行，通过则 L2 通过；未找到则跳过 L2。

#### Scenario: 验证命令通过
- **WHEN** 验证命令存在且 exit code 为 0
- **THEN** L2 SHALL 通过

#### Scenario: 验证命令失败
- **WHEN** 验证命令存在且 exit code 非 0
- **THEN** L2 SHALL 返回 fail，显示命令输出，不写状态文件

#### Scenario: 无验证命令
- **WHEN** config 和 package.json 均无有效验证命令
- **THEN** L2 SHALL 跳过，不影响整体结果

### Requirement: L3/L4 AI 检查——task-by-task 证据表
verify SHALL 由 AI 对 tasks.md 每条 task 逐一核查 diff 中是否存在对应实现，输出结构化证据表。未找到证据的 task 产生 warn。

#### Scenario: 输出 task-by-task 证据表
- **WHEN** L3/L4 检查运行
- **THEN** SHALL 输出每条 task 的检查结果：diff 中对应文件/行、✓（找到）或 ⚠（未找到）

#### Scenario: 部分 task 无对应 diff
- **WHEN** AI 判断某 task 在 diff 中无对应实现迹象
- **THEN** verify SHALL 产生 warn，列出具体 task 名和缺失原因

#### Scenario: 所有 task 有对应 diff
- **WHEN** AI 判断所有 task 在 diff 中均有对应实现
- **THEN** L3/L4 通过，不产生 warn
