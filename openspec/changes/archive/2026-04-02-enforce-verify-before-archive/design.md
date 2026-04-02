## Context

`/opsx:archive` 目前在归档前只检查 artifact 完整性，不验证实施质量。更根本的问题是：skill 是 markdown 提示词，不是程序，写在 skill 里的"SHALL NOT skip"没有执行力——AI 判断失误或上下文丢失时门禁就消失了。

harness engineering 的原则：约束不能依赖 AI 自我约束，必须在 AI 之外建立。

## Goals / Non-Goals

**Goals:**
- 把 verify gate 落到 hook 层（PreToolUse），而非 skill 提示词层
- archive 的 `mv` 命令被 hook 拦截，与 skill 是否"打算"跳过无关
- verify 通过后写状态文件，hook 检查状态文件——状态文件是 verify 和 hook 的合约
- commit 变化后状态文件自动过期，防止"验证完再改代码"绕过

**Non-Goals:**
- 不要求测试覆盖率达到某个阈值
- 不做 spec→test 映射（留作未来增强）
- 不修改 OpenSpec CLI 本身

## Decisions

**决策：verify 状态通过文件传递，hook 读文件判断**

状态文件路径：`openspec/changes/<name>/.verify-state.json`

```json
{
  "result": "pass",
  "userConfirmed": true,
  "commit": "abc1234",
  "timestamp": "2026-04-02T..."
}
```

- `/opsx:verify` 跑完后写入此文件
- hook 读此文件判断是否放行 archive mv 命令
- 文件不存在 = 未验证 → 阻断
- commit 不匹配当前 HEAD → 验证过期 → 阻断
- result 为 warn 且 userConfirmed 非 true → 阻断

理由：文件是客观事实，hook 读文件不依赖 AI 判断。

**决策：新增 `lib/verify_gate.js`，在 `pre_tool_use.js` 中调用**

检测模式：bash 命令匹配 `mv openspec/changes/<name> openspec/changes/archive/`

理由：职责分离，verify_gate 逻辑独立可测试。

**决策：分层验证，客观层 fail = 不写状态文件，AI 层 fail = warn + 要求用户确认**

| 层 | 检查 | 主体 | 结果 |
|---|---|---|---|
| L1 | tasks.md 所有 checkbox `[x]` 且 git diff（change 开始点到 HEAD）非空 | 程序 | fail → 不写状态文件 |
| L2 | 项目定义的验证命令通过（读 `openspec/config.yaml` 或 `package.json`） | 程序 | fail → 不写状态文件 |
| L3 | diff 文件与 tasks 描述相关（task-by-task 证据表） | AI | warn → 写 `{result:"warn"}` |
| L4 | tasks 语义与 diff 内容对齐（task-by-task 证据表） | AI | warn → 写 `{result:"warn"}` |

L1/L2 失败：不写状态文件，archive mv 被 hook 阻断（硬）
L3/L4 失败：写 `{result:"warn", userConfirmed:false}`，archive mv 被 hook 阻断，直到用户在 verify 中显式确认并写 `userConfirmed:true`

**决策：diff 基准为 change 开始点的 commit**

verify 时读取 `openspec/changes/<name>/.openspec.yaml`（如存在）中记录的 base commit，否则用 `git merge-base HEAD main`。

理由：避免 working tree diff 在 commit 后为空的误判。

**决策：L2 读项目定义的验证命令，不写死 `npm test`**

按优先级：
1. `openspec/config.yaml` 中 `verify_command` 字段
2. `package.json` scripts.test（非空且非 `echo`）
3. 无验证命令 → L2 跳过

理由：通用性，避免非 Node 项目失效。

**决策：L3/L4 输出 task-by-task 证据表**

```
Task 1.1: 添加 L1 检查
  → diff 中: common-dev/hooks/lib/verify_gate.js（新增）✓
Task 1.2: 添加 L2 检查
  → diff 中: 未找到对应实现 ⚠ warn
```

理由：用户看到具体证据才能判断 warn 是否值得跳过。

**决策：OPENSPEC_SKIP=1 同样豁免 verify gate**

理由：紧急豁免应全局生效，与现有机制一致。

## Risks / Trade-offs

- [风险] bash 命令模式匹配误判（如路径含空格） → 用正则严格匹配，测试覆盖边缘 case
- [风险] 状态文件手动删除绕过门禁 → 这是用户主动行为，与 OPENSPEC_SKIP 等价，可接受
- [风险] verify_gate 读取 git HEAD 耗时 → execSync 调用，<10ms，可接受
