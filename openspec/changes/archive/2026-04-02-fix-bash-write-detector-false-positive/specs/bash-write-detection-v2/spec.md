## MODIFIED Requirements

### Requirement: Subshell write detection

`isBashWriteCommand` SHALL 检测 subshell 命令（`bash -c`、`sh -c`、`eval`）中的写操作。当参数字符串包含写指示符时，SHALL 先尝试 `extractWriteTargets` 提取写入目标。如果提取到目标，SHALL 对每个目标调用 `isSourceTarget` 过滤；如果任一目标是源文件则返回 true。如果未提取到任何目标且写指示符为代码级写 API（`write(`、`open(`、`fs.`、`writeFile`），SHALL 保守返回 true。如果未提取到任何目标且写指示符仅为 shell 重定向，SHALL 返回 false。

#### Scenario: bash -c with redirect to source file detected

- **WHEN** command is `bash -c "echo secret > src/config.js"`
- **THEN** `isBashWriteCommand` SHALL return `true`

#### Scenario: eval with redirect to external path not flagged

- **WHEN** command is `eval "echo data >> ~/.gstack/analytics/usage.jsonl"`
- **THEN** `isBashWriteCommand` SHALL return `false`（`~/.gstack/analytics/usage.jsonl` 不匹配 SOURCE_EXTENSIONS 和 SOURCE_DIRS）

#### Scenario: bash -c without write indicators allowed

- **WHEN** command is `bash -c "echo hello"`
- **THEN** `isBashWriteCommand` SHALL return `false`

#### Scenario: eval with unparseable inner script and code write API conservatively flagged

- **WHEN** command is `eval "$(complex_command)" && fs.writeFileSync(path, data)`，且 `extractWriteTargets` 无法提取任何目标
- **THEN** `isBashWriteCommand` SHALL return `true`（保守行为，因为检测到代码级写 API）

#### Scenario: eval with only fd redirects not flagged

- **WHEN** command is `eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)"`
- **THEN** `isBashWriteCommand` SHALL return `false`（`2>/dev/null` 是 fd 重定向，不是文件写入，且无代码级写 API）

#### Scenario: eval with fd redirect and echo to dev null

- **WHEN** command is `eval "$(some-cmd 2>/dev/null)" && ls dir 2>/dev/null || echo "fallback"`
- **THEN** `isBashWriteCommand` SHALL return `false`（所有 `>` 均为 fd 重定向到 /dev/null）

### Requirement: Script interpreter write detection

`isBashWriteCommand` SHALL 检测 `python -c`、`python3 -c`、`node -e`、`ruby -e`、`perl -e` 中的写操作。当参数包含写指示符时，SHALL 先尝试 `extractWriteTargets` 提取写入目标。如果提取到目标，SHALL 对每个目标调用 `isSourceTarget` 过滤；如果任一目标是源文件则返回 true。如果未提取到任何目标且写指示符为代码级写 API，SHALL 保守返回 true。如果未提取到任何目标且写指示符仅为 shell 重定向，SHALL 返回 false。

#### Scenario: python -c with open() to source file detected

- **WHEN** command is `python -c "open('src/hack.py','w').write('x')"`
- **THEN** `isBashWriteCommand` SHALL return `true`

#### Scenario: node -e with fs writing to external path not flagged

- **WHEN** command is `node -e "require('fs').writeFileSync('/Users/x/.gstack/data.json','y')"`
- **THEN** `isBashWriteCommand` SHALL return `false`

#### Scenario: python -c without write indicators allowed

- **WHEN** command is `python -c "print('hello')"`
- **THEN** `isBashWriteCommand` SHALL return `false`

#### Scenario: python3 -c piped with only fd redirects not flagged

- **WHEN** command is `some-cmd --json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin))"`
- **THEN** `isBashWriteCommand` SHALL return `false`（python3 -c 中无代码写 API，`2>/dev/null` 是 fd 重定向）

### Requirement: /tmp and /dev exclusions preserved

`extractWriteTargets` SHALL 提取所有重定向目标，包括 fd 前缀的重定向到实际文件（如 `1>src/file.js`）。SHALL 排除 fd-to-null（`N>/dev/null`）、fd-to-fd（`N>&M`、`N>&-`）重定向。`isSourceTarget()` SHALL 继续排除 `/tmp/` 和 `/dev/` 路径。

#### Scenario: 2>/dev/null 不被提取为写入目标

- **WHEN** command 是 `_UPD=$(~/.claude/skills/gstack/bin/gstack-update-check 2>/dev/null || true)`
- **THEN** `extractWriteTargets` SHALL 返回空列表

#### Scenario: 2>&1 不被提取为写入目标

- **WHEN** command 是 `some-command 2>&1 | grep error`
- **THEN** `extractWriteTargets` SHALL 不包含 `&1`

#### Scenario: 标准输出重定向仍被检测

- **WHEN** command 是 `echo "data" > src/config.js`
- **THEN** `extractWriteTargets` SHALL 返回包含 `src/config.js` 的列表

#### Scenario: fd 1 重定向到实际文件被检测

- **WHEN** command 是 `echo "data" 1>src/output.js`
- **THEN** `extractWriteTargets` SHALL 返回包含 `src/output.js` 的列表

#### Scenario: fd 2 重定向到实际文件被检测

- **WHEN** command 是 `some-cmd 2>error.log`
- **THEN** `extractWriteTargets` SHALL 返回包含 `error.log` 的列表

#### Scenario: curl to /tmp not flagged

- **WHEN** command 是 `curl -o /tmp/download.json https://example.com`
- **THEN** `isBashWriteCommand` SHALL 返回 `false`
