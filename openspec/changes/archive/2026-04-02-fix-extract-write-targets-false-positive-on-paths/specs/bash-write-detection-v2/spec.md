## ADDED Requirements

### Requirement: Git commands exempt from write detection

`isBashWriteCommand` SHALL 在检测写操作前，先检查命令是否为纯 git 命令。如果命令仅包含 git 子命令（add、commit、status、log、diff、push、pull、fetch、merge、checkout、branch、stash、rebase、tag、remote、show、blame、rev-parse、rev-list、symbolic-ref），SHALL 直接返回 false，不做后续写操作检测。

#### Scenario: git add not detected as write

- **WHEN** command 是 `git add openspec/specs/simplified-installer/spec.md`
- **THEN** `isBashWriteCommand` SHALL return `false`

#### Scenario: git commit with heredoc not detected as write

- **WHEN** command 是 `git commit -m "$(cat <<'EOF'\nfeat: auto-generates <plugin-name>-commands.md\nEOF\n)"`
- **THEN** `isBashWriteCommand` SHALL return `false`

#### Scenario: git push not detected as write

- **WHEN** command 是 `git push -u origin feat/my-feature`
- **THEN** `isBashWriteCommand` SHALL return `false`

#### Scenario: git chained with non-git command still checked

- **WHEN** command 是 `git add file.js && echo "done" > src/result.js`
- **THEN** `isBashWriteCommand` SHALL return `true`（因为 echo 重定向到源文件）

## MODIFIED Requirements

### Requirement: /tmp and /dev exclusions preserved

`extractWriteTargets` SHALL 提取所有重定向目标，包括 fd 前缀的重定向到实际文件（如 `1>src/file.js`）。SHALL 排除 fd-to-null（`N>/dev/null`）、fd-to-fd（`N>&M`、`N>&-`）重定向。`isSourceTarget()` SHALL 继续排除 `/tmp/` 和 `/dev/` 路径。

`extractWriteTargets` 的 install 正则 SHALL 仅匹配 `install` 作为独立命令（出现在命令起始位置或管道/分号/`&&` 之后），不匹配文件路径中包含 "install" 子串的情况。

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

#### Scenario: install in file path not matched

- **WHEN** command 是 `git add openspec/specs/simplified-installer/spec.md`
- **THEN** `extractWriteTargets` 的 install 正则 SHALL 不匹配该路径

#### Scenario: standalone install command still matched

- **WHEN** command 是 `install -m 755 build/app src/app`
- **THEN** `extractWriteTargets` SHALL 返回包含 `src/app` 的列表
