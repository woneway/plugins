## MODIFIED Requirements

### Requirement: Subshell write detection

`isBashWriteCommand` SHALL 检测 subshell 命令（`bash -c`、`sh -c`、`eval`）中的写操作。当参数字符串包含写指示符时，SHALL 先尝试 `extractWriteTargets` 提取写入目标。如果提取到目标，SHALL 对每个目标调用 `isSourceTarget` 过滤；如果任一目标是源文件则返回 true。如果未提取到任何目标（内嵌脚本无法静态解析），SHALL 保守返回 true。

#### Scenario: bash -c with redirect to source file detected

- **WHEN** command is `bash -c "echo secret > src/config.js"`
- **THEN** `isBashWriteCommand` SHALL return `true`

#### Scenario: eval with redirect to external path not flagged

- **WHEN** command is `eval "echo data >> ~/.gstack/analytics/usage.jsonl"`
- **THEN** `isBashWriteCommand` SHALL return `false`（`~/.gstack/analytics/usage.jsonl` 不匹配 SOURCE_EXTENSIONS 和 SOURCE_DIRS）

#### Scenario: bash -c without write indicators allowed

- **WHEN** command is `bash -c "echo hello"`
- **THEN** `isBashWriteCommand` SHALL return `false`

#### Scenario: eval with unparseable inner script conservatively flagged

- **WHEN** command is `eval "$(complex_command_that_generates_script)"`，且 `extractWriteTargets` 无法提取任何目标
- **THEN** `isBashWriteCommand` SHALL return `true`（保守行为）

### Requirement: Script interpreter write detection

`isBashWriteCommand` SHALL 检测 `python -c`、`python3 -c`、`node -e`、`ruby -e`、`perl -e` 中的写操作。当参数包含写指示符时，SHALL 先尝试 `extractWriteTargets` 提取写入目标。如果提取到目标，SHALL 对每个目标调用 `isSourceTarget` 过滤；如果任一目标是源文件则返回 true。如果未提取到任何目标，SHALL 保守返回 true。

#### Scenario: python -c with open() to source file detected

- **WHEN** command is `python -c "open('src/hack.py','w').write('x')"`
- **THEN** `isBashWriteCommand` SHALL return `true`

#### Scenario: node -e with fs writing to external path not flagged

- **WHEN** command is `node -e "require('fs').writeFileSync('/Users/x/.gstack/data.json','y')"`
- **THEN** `isBashWriteCommand` SHALL return `false`

#### Scenario: python -c without write indicators allowed

- **WHEN** command is `python -c "print('hello')"`
- **THEN** `isBashWriteCommand` SHALL return `false`
