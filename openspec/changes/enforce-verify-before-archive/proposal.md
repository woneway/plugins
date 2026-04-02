## Why

harness 管住了"开始前"（没有 change 阻断、没有 tasks.md 阻断），但没管住"结束后"：AI 把 tasks 的 checkbox 全打上 `[x]` 之后没有任何验证，archive 直接放行。`/opsx:verify` skill 存在但是手动且可跳过，不构成真正的门禁。

## What Changes

- **BREAKING**：`/opsx:archive` 流程新增强制 verify 步骤——verify 未通过不允许归档
- `/opsx:verify` 增加 tasks→diff 对照逻辑：对比 tasks.md 描述与实际 git diff，判断实施是否与计划对齐
- verify 结果分三级：`pass`（放行）、`warn`（提示但允许用户确认后归档）、`fail`（阻断）

## Capabilities

### New Capabilities

- `verify-gate`: archive 前强制 verify 的门禁逻辑——检查条件、结果分级、阻断规则

### Modified Capabilities

- （无现有 spec 需要修改，archive 流程由 skill 实现，不在 spec 层）

## Impact

- `opsx:archive` skill 流程：新增 verify 调用步骤
- `opsx:verify` skill：新增 tasks→diff 对照逻辑
- 不影响任何 hook 或安装器代码
