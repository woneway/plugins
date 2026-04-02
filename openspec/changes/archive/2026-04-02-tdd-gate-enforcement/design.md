## Context

harness 编排器 `pre_tool_use.js` 采用可插拔 gate 架构：每个 gate 是独立的 `lib/*.js` 模块，在编排器中按序检查。当前已有 `api_key_check`、`bash_write_detector`、`verify_gate`、`openspec` 状态机四个 gate。

TDD gate 将作为第五个 gate 并联进来，强制"先有测试文件，才能写实现文件"。

## Goals / Non-Goals

**Goals:**
- 在 `pre_tool_use.js` 中新增 TDD gate，写实现文件时若无对应测试文件则阻断
- 与现有 gate 架构同构：独立模块、独立测试、环境变量豁免
- 合理的白名单机制，避免误阻断配置文件、文档等非实现文件

**Non-Goals:**
- 不跟踪 RED→GREEN→REFACTOR 状态机（复杂度高，收益不明确）
- 不检查测试覆盖率（那是 CI 的职责）
- 不要求测试文件名与实现文件名完全一一对应（只检查存在性）
- 不修改 OpenSpec 状态机

## Decisions

**决策：TDD gate 仅在 OpenSpec 状态为 `ready_to_apply` 时激活**

TDD gate 的前提是"已进入实施阶段"。在 `not_initialized`（兼容模式）、`no_active_change`、`planning` 状态下不检查——这些状态要么已被 OpenSpec 门禁阻断，要么不适用 TDD 约束。

理由：避免在非 OpenSpec 项目或规划阶段产生无意义的阻断。

**决策：检查时机放在 OpenSpec 门禁之后**

编排顺序：
```
1.  API Key 检查
1b. API Key 内容检查
1c. Verify Gate（archive mv）
2.  isWriteOperation()
2b. Repo 外路径放行
3.  OpenSpec 路径白名单
4.  OPENSPEC_SKIP 豁免
5.  OpenSpec 工作流门禁
6.  TDD Gate              ← NEW
```

理由：TDD gate 依赖 OpenSpec 状态判断（只在 `ready_to_apply` 时激活），且需要排除 openspec/ 白名单路径（步骤 3 已处理）。放在最后一步，仅对"已通过所有前置检查的实现文件写操作"做 TDD 约束。

**决策：通过文件名模式匹配判断"实现文件"和"测试文件"**

白名单（不受 TDD gate 约束）：
- 测试文件：`*.test.js`, `*.spec.js`, `__tests__/**`
- 配置文件：`package.json`, `*.config.js`, `*.config.ts`, `.eslintrc*`, `.prettierrc*`
- 文档：`*.md`
- 类型声明：`*.d.ts`
- 资源文件：`*.json`, `*.yaml`, `*.yml`（除 package.json 外已被覆盖）
- `bin/` 目录下的入口脚本

对于非白名单文件（实现文件），检查是否存在对应测试文件。匹配规则：
- `lib/foo.js` → 查找 `__tests__/foo.test.js` 或 `lib/foo.test.js`
- `hooks/pre_tool_use.js` → 查找 `hooks/__tests__/pre_tool_use.test.js`

理由：基于文件系统的检查可以用 `fs.existsSync` 实现，无需复杂的 AST 分析或状态追踪。

**决策：`TDD_SKIP=1` 环境变量豁免**

与 `OPENSPEC_SKIP=1` 同构设计。跳过时记录日志到 `.claude/tdd-skip-log.jsonl`。

理由：紧急情况下需要绕过机制，但要留审计痕迹。

**决策：阻断信息提示先写测试**

阻断时输出：
```
[TDD] 变更被阻断：文件 <path> 没有对应的测试文件。
请先创建测试文件（如 __tests__/<name>.test.js），再编写实现代码。
提示：使用 tdd-guide agent 可以帮助你编写测试。
```

理由：阻断消息要给出可行动的建议，引导 AI 走正确的路径。

## Risks / Trade-offs

- [风险] 测试文件匹配规则误判（项目使用非标准测试目录结构）→ 白名单可配置化（留作后续增强），当前覆盖常见 Node.js 项目结构
- [风险] 编辑已有文件时触发 TDD gate（已有代码可能没有测试）→ TDD gate 对所有实现文件一视同仁；如果遗留代码缺测试，TDD gate 会强制补测试后才能修改，这是有意为之
- [风险] Bash 写命令的目标文件提取不准确 → 复用现有 `bash_write_detector.js` 的 `extractWriteTargets()`，该模块已有充分测试
- [权衡] 只检查测试文件存在性，不验证测试内容是否有意义 → 有意为之，保持 gate 的轻量和快速，测试质量由 CI 和 code review 保障
