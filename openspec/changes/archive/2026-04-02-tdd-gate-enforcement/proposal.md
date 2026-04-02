## Why

harness 的底盘层（结构约束）当前只有 OpenSpec 状态机强制"先规划再实施"。TDD 是同构的底盘约束——"先写测试再写实现"——但目前仅作为 prompt 建议存在于 SessionStart 注入中，没有 hook 级强制。AI 可以完全忽略建议直接写实现代码，这与 harness engineering "约束不能依赖 AI 自我约束"的原则矛盾。

## What Changes

- 新增 `lib/tdd_gate.js` 模块：检测实现文件写操作时，对应的测试文件是否存在
- 修改 `pre_tool_use.js`：在 OpenSpec 门禁放行后增加 TDD gate 检查
- 支持白名单：测试文件、配置文件、文档、OpenSpec artifact 不受 TDD gate 约束
- 支持 `TDD_SKIP=1` 环境变量豁免，与 `OPENSPEC_SKIP` 同构

## Capabilities

### New Capabilities
- `tdd-gate`: 实现文件写操作前强制要求对应测试文件存在的 hook 级门禁

### Modified Capabilities
（无——TDD gate 作为独立 gate 并联在 pre_tool_use.js 编排器中，不修改现有 spec 的行为）

## Impact

- `common-dev/hooks/pre_tool_use.js`：新增 TDD gate 检查段
- `common-dev/hooks/lib/tdd_gate.js`：新增模块
- `common-dev/hooks/__tests__/tdd_gate.test.js`：新增测试
- `common-dev/hooks/__tests__/pre_tool_use.test.js`：新增集成测试用例
