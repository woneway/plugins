## ADDED Requirements

### Requirement: current-change 标记文件

`/opsx:apply <name>` SHALL 在开始实施前写入 `.claude/current-change`（或 `.codex/current-change`，按运行时选择）。文件内容为 change 名称（纯文本，无换行）。`/opsx:archive` SHALL 在归档完成后删除该文件。`/opsx:apply <other-name>` SHALL 覆写该文件。

#### Scenario: apply 写入 current-change
- **WHEN** 用户运行 `/opsx:apply harness-enforcement-hardening`
- **THEN** SHALL 创建 `.claude/current-change`，内容为 `harness-enforcement-hardening`

#### Scenario: apply 切换 change
- **WHEN** `.claude/current-change` 内容为 `change-a`
- **AND** 用户运行 `/opsx:apply change-b`
- **THEN** SHALL 覆写为 `change-b`

#### Scenario: archive 删除 current-change
- **WHEN** 用户运行 `/opsx:archive change-a`
- **AND** `.claude/current-change` 内容为 `change-a`
- **THEN** SHALL 删除 `.claude/current-change`

### Requirement: pre_tool_use 读取 current-change 确定单一 change

`pre_tool_use.js` 在 `ready_to_apply` 状态下 SHALL 读取 `.claude/current-change`（或 `.codex/current-change`）确定当前 change 名称。读取失败时 SHALL fallback 为现有行为（不做 scope 检查，仅按 ready_to_apply 放行）。

#### Scenario: current-change 存在且有效
- **WHEN** `.claude/current-change` 内容为 `harness-enforcement-hardening`
- **AND** `openspec/changes/harness-enforcement-hardening/tasks.md` 存在
- **THEN** SHALL 使用该 change 的 tasks.md 提取 allowedPaths

#### Scenario: current-change 不存在
- **WHEN** `.claude/current-change` 文件不存在
- **THEN** SHALL fallback 为现有行为（ready_to_apply 直接放行，无 scope 检查）
- **AND** SHALL 不输出 warning（向后兼容）

#### Scenario: current-change 指向已不存在的 change
- **WHEN** `.claude/current-change` 内容为 `deleted-change`
- **AND** `openspec/changes/deleted-change/` 目录不存在
- **THEN** SHALL fallback 为现有行为

### Requirement: extractPathsFromTasks 文件路径提取

新增 `extractPathsFromTasks(tasksContent)` 函数，从 tasks.md 内容中提取文件路径列表。

#### Scenario: backtick 包裹的路径
- **WHEN** task 行是 `` - [ ] 修改 `common-dev/hooks/pre_tool_use.js` 编排器 ``
- **THEN** SHALL 提取 `common-dev/hooks/pre_tool_use.js`

#### Scenario: 含 `/` 的源文件路径
- **WHEN** task 行是 `- [ ] 1.5 common-dev/hooks/lib/openspec.js — getOpenSpecState catch 块`
- **THEN** SHALL 提取 `common-dev/hooks/lib/openspec.js`

#### Scenario: 目录前缀（以 `/` 结尾）
- **WHEN** task 行是 `- [ ] 更新 hooks/__tests__/ 下的测试文件`
- **THEN** SHALL 提取 `hooks/__tests__/` 作为目录前缀

#### Scenario: URL 不被误提取
- **WHEN** task 行是 `- [ ] 参考 https://example.com/docs/api.js 实现`
- **THEN** SHALL 不提取任何路径

#### Scenario: openspec 路径忽略
- **WHEN** task 行是 `- [ ] 更新 openspec/specs/verify-gate/spec.md`
- **THEN** SHALL 不提取该路径（openspec 路径已有独立白名单）

#### Scenario: 无可提取路径
- **WHEN** tasks.md 中所有 task 行都不包含可识别的文件路径
- **THEN** SHALL 返回空数组
- **AND** 调用方 SHALL 输出 `[WARN] change-scope: no paths extracted from tasks.md` 到 stderr

### Requirement: change-scope 校验

当 `current-change` 有效且 `allowedPaths` 非空时，`pre_tool_use.js` SHALL 检查写操作目标文件是否在范围内。

#### Scenario: 写操作目标在 allowedPaths 范围内
- **WHEN** Edit 工具写入 `common-dev/hooks/lib/verify_gate.js`
- **AND** `allowedPaths` 包含 `common-dev/hooks/lib/verify_gate.js`
- **THEN** SHALL 放行

#### Scenario: 写操作目标在 allowedPaths 目录前缀内
- **WHEN** Write 工具写入 `common-dev/hooks/__tests__/verify_gate.test.js`
- **AND** `allowedPaths` 包含 `common-dev/hooks/__tests__/`
- **THEN** SHALL 放行（前缀匹配）

#### Scenario: 写操作目标不在范围内
- **WHEN** Edit 工具写入 `lib/installer.js`
- **AND** `allowedPaths` 不包含该路径或其前缀
- **THEN** SHALL 阻断（exit 2），提示"文件不在当前变更 <name> 的范围内"

#### Scenario: allowedPaths 为空时 fallback 全放行
- **WHEN** `allowedPaths` 为空数组
- **THEN** SHALL 放行所有写操作（向后兼容）

#### Scenario: 测试文件配对放行（复用 tdd_gate 逻辑）
- **WHEN** Edit 工具写入 `common-dev/hooks/__tests__/verify_gate.test.js`
- **AND** `allowedPaths` 包含 `common-dev/hooks/lib/verify_gate.js`
- **THEN** SHALL 放行（使用 `tdd_gate.js` 的 `hasTestFile()` 反向映射：实现文件在 scope → 其测试文件也在 scope）
