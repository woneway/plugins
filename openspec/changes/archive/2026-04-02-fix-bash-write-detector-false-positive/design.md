## Context

`bash_write_detector.js` 中有三层检测逻辑互相配合：

1. **WRITE_INDICATORS**（快速筛选）：正则扫描命令字符串，判断是否"可能包含写操作"
2. **extractWriteTargets**（精确提取）：从命令中提取所有写入目标路径
3. **isBashWriteCommand**（决策）：综合以上两者，对 eval/bash-c/python-c 等子 shell 模式使用保守回退

当前问题：WRITE_INDICATORS 的 `[>]` 匹配任意 `>` 字符（含 fd 重定向），而 extractWriteTargets 用 `(?<![0-9])>` 正确排除 fd 重定向。两者不对齐导致：eval 命令中的 `2>/dev/null` 被 WRITE_INDICATORS 标记为"疑似写"，但 extractWriteTargets 提取不到目标，保守回退误判为写操作。

## Goals / Non-Goals

**Goals:**

- 消除 `eval`/`bash -c`/`python3 -c` + `2>/dev/null` 组合的误判
- 保留对真实子 shell 写操作（如 `eval "echo x > src/file.js"`）的检测能力
- 修正 `extractWriteTargets` 对 `1>file.js` 的漏检（fd 1 重定向到实际文件）
- 统一 WRITE_INDICATORS 和 extractWriteTargets 的重定向处理逻辑

**Non-Goals:**

- 不重构整体架构（保持快速筛选 + 精确提取的两阶段设计）
- 不修改 pre_tool_use.js 的门禁逻辑
- 不处理 subshell 内嵌套的动态脚本生成（已有保守回退覆盖）

## Decisions

### Decision 1: 将 WRITE_INDICATORS 拆分为重定向检测和代码写 API 检测

**选择：** 将 WRITE_INDICATORS 正则拆为两个常量：
- `REDIRECT_WRITE_INDICATOR`：`(?<![0-9])>{1,2}` — 仅匹配非 fd 前缀的重定向
- `CODE_WRITE_INDICATOR`：`\bwrite\w*\(|\bopen\s*\(|\bfs[.'"]|\bwriteFile` — 代码级写 API

**为什么不只改 WRITE_INDICATORS：** 保守回退逻辑需要区分"检测到代码写 API 但提不到文件目标"（应保守判写）和"只有 fd 重定向"（不应判写）。单一正则无法区分这两种情况。

**替代方案：** 只改正则为 `(?<![0-9])>{1,2}|...`。更简单但仍无法区分保守回退的两种场景。

### Decision 2: 保守回退仅在检测到代码写 API 时触发

**选择：** 在 eval/bash-c/node-e 分支中，当 `targets.length === 0` 时：
- 如果是 CODE_WRITE_INDICATOR 匹配（`fs.writeFile` 等），保守返回 true（无法静态分析内嵌代码的写目标）
- 如果仅是 REDIRECT_WRITE_INDICATOR 匹配，返回 false（fd 重定向已被正确排除）

**原因：** 对 `eval "$(cmd 2>/dev/null)"` 这种命令，重定向目标已完全可解析。保守回退只在目标真正不可解析时才有意义。

### Decision 3: 修正 extractWriteTargets 的 fd 重定向排除规则

**选择：** 将 `(?<![0-9])>{1,2}\s*(\S+)` 改为排除 fd-to-null 和 fd-to-fd，但保留 fd-to-file：
- 排除：`2>/dev/null`、`2>&1`、`2>&-` 等
- 保留：`1>src/file.js`、`2>error.log`（这些是真实文件写入）

**实现方式：** 移除 lookbehind，改为先匹配所有 `>{1,2}` 重定向，再在后处理中排除目标为 `/dev/null`、`/dev/` 开头、或 `&` 开头（fd 复制）的条目。

**替代方案：** 保持 lookbehind 但改为仅排除 `2>`。风险是排除粒度太粗且不够灵活。

## Risks / Trade-offs

**[Risk] `1>file` 写法在实际使用中极少** → 这个修正增加了安全性但可能永远不会实际触发。值得做，因为改动量很小。

**[Risk] 正则拆分增加了代码量** → 从 1 个常量变为 2 个，但逻辑更清晰，减少了未来类似误判的概率。

**[Risk] 移除 lookbehind 后重定向匹配更宽泛** → 通过后处理过滤（排除 /dev/ 和 & 开头目标）补偿，不会引入新的误报。
