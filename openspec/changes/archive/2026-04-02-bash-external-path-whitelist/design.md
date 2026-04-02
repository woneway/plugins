## Context

`pre_tool_use.js` 的检查流程：API Key → 是否写操作 → repo 外放行 → openspec 白名单 → OPENSPEC_SKIP → 门禁。其中 repo 外放行（步骤 2b）仅对 Edit/Write/MultiEdit/NotebookEdit 生效。Bash 工具被 `isBashWriteCommand()` 判定为写操作后直接进入门禁，没有机会被 repo 外路径豁免。

`isBashWriteCommand()` 对 `eval`/`bash -c` 模式只做关键词匹配（包含 `>`、`>>` 等写指示符就返回 true），不提取具体写入目标。这意味着即使所有写入都指向 `~/.gstack/`，也被判定为写操作。

## Goals / Non-Goals

**Goals:**
- Bash 写入 repo 外路径时跳过 OpenSpec 门禁，与 Edit/Write 行为对称
- 改进 eval/bash -c 模式的检测精度：能提取目标时走 target 检查，无法提取时保守判定
- 保持 API Key 检查不受影响（在路径放行之前执行）

**Non-Goals:**
- 不修改 Edit/Write 的现有逻辑
- 不修改 OpenSpec 状态机逻辑
- 不追求完美解析所有 eval 内嵌脚本（保守方向：无法判定时仍视为写操作）

## Decisions

1. **Bash repo 外路径放行**：在 `pre_tool_use.js` 步骤 2b 中新增 Bash 分支。使用 `extractWriteTargets()` 提取写入目标，对每个目标做 `path.resolve` + `path.relative` 判断是否在 repo 外。所有目标都在 repo 外时放行。

2. **eval/subshell 改进策略**：修改 `isBashWriteCommand` 中 eval/bash -c/interpreter 的逻辑。当检测到写指示符时，不直接返回 true，而是先尝试 `extractWriteTargets` 提取目标。如果提取到目标，走 `isSourceTarget` 过滤；如果没有提取到任何目标（内嵌脚本太复杂无法解析），保守返回 true。

3. **无法提取目标时的兜底**：对于 `eval "$(some_command)"` 这种模式，内部的写入目标可能在子进程中动态生成，无法静态提取。此时保守判定为写操作，由 `pre_tool_use.js` 的 repo 外路径检查做第二道过滤。但如果 `extractWriteTargets` 也拿不到 target（targets 为空），则 repo 外路径检查也无法判定，仍会进入门禁。这是可接受的保守行为——用户可以用 `OPENSPEC_SKIP=1` 豁免。

## Risks / Trade-offs

- [风险] eval 内嵌复杂脚本无法解析 → 保守判定为写操作，不会误放行
- [风险] 改变 eval/bash -c 检测逻辑可能漏掉某些写操作 → 仅在提取到 target 且 target 不是源文件时才放行，无 target 时仍保守拦截
- [权衡] 方案对 preamble 类的长命令仍有盲区（eval 内嵌 `>>`），但 `pre_tool_use.js` 层的 `extractWriteTargets` 可以从外层命令提取到 `~/.gstack/analytics/...` 目标做放行
