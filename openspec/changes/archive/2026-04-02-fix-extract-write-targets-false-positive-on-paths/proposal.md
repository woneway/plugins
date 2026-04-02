## Why

`extractWriteTargets` 的正则在整个命令字符串上做匹配，不区分 shell 操作符和引号/heredoc 内的文本内容，也不区分独立命令和文件路径中的子串。导致 `git add`/`git commit` 等非写操作被误判为写操作，触发 OpenSpec 门禁拦截。

具体场景：
1. `git commit -m "$(cat <<'EOF' ... <plugin-name>-commands.md ... EOF)"` — heredoc 文本中的 `>` 被重定向正则匹配
2. `git add openspec/specs/simplified-installer/spec.md` — 路径中的 "install" 被 install 正则匹配

## What Changes

- 修改重定向提取正则，排除 heredoc 内容（`<<` 到 EOF 之间的文本）和引号内的 `>`
- 修改 `install` 正则，要求 `install` 作为独立命令出现在命令开头或管道/分号之后，而非路径中的子串
- 对 `git add`/`git commit`/`git` 命令整体豁免，这些命令不写文件

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `bash-write-detection-v2`: extractWriteTargets 正则修正，git 命令豁免

## Impact

- 受影响文件：`common-dev/hooks/lib/bash_write_detector.js`
- 不影响 API 或外部接口
- 修复后 `git add`/`git commit` 命令不再被误判为写操作
