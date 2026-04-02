## Why

OpenSpec 工作流门禁的实际约束力低于设计意图。经 Claude + Codex 交叉审计发现三个结构性缺陷：(1) 写操作不绑定具体 change，任一 change 有 tasks.md 即全 repo 放行；(2) verify gate 只认一种 mv 模式且不检查 dirty worktree；(3) 多处 fail-open（异常即放行）无审计痕迹，削弱 harness 可信度。这些缺陷使得 harness "名存实亡"——需要先把现有门禁锁实，再考虑扩展新能力。

## What Changes

- 引入"当前 change"上下文机制：`/opsx:apply` 写入 `.claude/current-change` 标记文件，hook 读取该文件确定单一活跃 change，从该 change 的 tasks.md 提取文件范围作为写操作白名单
- 加固 `verify_gate.js`：检测替代归档路径（`cp`、`rsync` 变体）；在 commit hash 匹配基础上增加 dirty worktree 检查（仅限 change 相关文件）
- 为所有 fail-open 路径（`catch {}` 静默放行）添加 stderr warning 输出，保留审计痕迹但不改变 fail-open 策略

## Capabilities

### New Capabilities
- `change-scope-binding`: 单 change 上下文的写操作范围绑定——通过 `.claude/current-change` 标记确定当前 change，从其 tasks.md 提取文件路径作为写操作白名单

### Modified Capabilities
- `verify-gate`: 加固归档检测模式（覆盖 cp/rsync 变体）+ change 相关文件的 dirty worktree 检查

## Impact

- `common-dev/hooks/lib/openspec.js` — 新增 `extractPathsFromTasks()` + `getOpenSpecState()` 扩展
- `common-dev/hooks/lib/verify_gate.js` — 检测模式扩展 + change-scoped dirty worktree 检查
- `common-dev/hooks/pre_tool_use.js` — 编排器增加 change-scope 校验 + fail-open warning
- `common-dev/hooks/lib/tdd_gate.js` — fail-open catch 块添加 warning
- `common-dev/commands/opsx/apply.md` — apply 启动时写 `.claude/current-change`
- 所有对应 `__tests__/` 文件需同步更新
