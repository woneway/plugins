## Why

`pre_tool_use.js` 对 Edit/Write 工具有 repo 外路径豁免（写入 `~/.gstack/`、`~/.claude/` 等不受 OpenSpec 门禁管控），但 Bash 工具缺少对应的豁免逻辑。当 Bash 命令仅写入 repo 外路径时（如 gstack preamble 的 `touch ~/.gstack/sessions/`、`echo >> ~/.gstack/analytics/`），仍被 OpenSpec 门禁阻断。这导致 `/ship` 等 skill 无法正常运行。

问题出在两层：
1. `pre_tool_use.js` 第 106-116 行的 repo 外路径放行仅限 Edit/Write，Bash 未覆盖
2. `isBashWriteCommand` 对 `eval`/`bash -c` 模式检测到写指示符（如 `>>`）后直接返回 true，跳过 target 提取，无法判断"写到哪里"

## What Changes

- `pre_tool_use.js`：在 repo 外路径放行逻辑中增加 Bash 工具支持，当所有写入目标都在 repo 外时放行
- `bash_write_detector.js`：为 `eval`/`bash -c`/脚本解释器模式增加 target 提取能力，使其也经过 `isSourceTarget` 过滤，而非无条件返回 true

## Capabilities

### New Capabilities

无

### Modified Capabilities

- `repo-external-path-whitelist`: 扩展覆盖范围到 Bash 工具，当 Bash 命令的所有写入目标都在 repo 外时跳过 OpenSpec 门禁
- `bash-write-detection-v2`: 改进 eval/bash -c/脚本解释器模式的检测逻辑，增加 target 提取而非无条件判定为写操作

## Impact

- `common-dev/hooks/pre_tool_use.js` — 新增 Bash 的 repo 外路径检查逻辑
- `common-dev/hooks/lib/bash_write_detector.js` — 修改 eval/subshell/interpreter 检测逻辑
- `common-dev/hooks/__tests__/` — 新增对应测试用例
- 不影响 API Key 检查（在路径放行之前执行）
- 不影响 OpenSpec 路径白名单逻辑
