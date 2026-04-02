## Why

`WRITE_INDICATORS` 正则中的 `[>]` 会匹配 fd 重定向（如 `2>/dev/null`）中的 `>` 字符，而 `extractWriteTargets` 正确地排除了这些 fd 重定向。两者逻辑不对齐导致 eval/bash-c/python-c 分支的保守回退误判纯读命令为写操作，触发 OpenSpec 门禁拦截。

## What Changes

- 将 `WRITE_INDICATORS` 中的重定向检测从裸 `[>]|>>` 改为 `(?<![0-9])>{1,2}`，排除 fd 重定向
- 在 eval/bash-c/node-e 分支中，将保守回退限定在检测到代码级写操作 API（`write(`, `fs.`, `writeFile`）时，而不是所有含 `>` 字符的情况
- 修正 `extractWriteTargets` 的 fd 重定向排除逻辑：仅排除 fd-to-null 和 fd-to-fd（`2>/dev/null`、`2>&1`），不排除 fd-to-file（`1>src/file.js`）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `bash-write-detection-v2`: WRITE_INDICATORS 正则和 isBashWriteCommand 保守回退逻辑变更，extractWriteTargets fd 重定向排除规则收紧

## Impact

- 受影响文件：`common-dev/hooks/lib/bash_write_detector.js`
- 不影响 API 或外部接口
- 修复后 gstack 技能的纯读 Bash 命令（含 `2>/dev/null`、`eval`、`python3 -c`）不再被误判为写操作
- `1>file.js` 这种 fd 重定向到实际文件的场景将被正确检测为写操作（之前也漏掉了）
