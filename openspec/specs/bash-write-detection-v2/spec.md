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

#### Scenario: git with redirect to source file still checked

- **WHEN** command 是 `git log --oneline > src/output.js`
- **THEN** `isBashWriteCommand` SHALL return `true`（因为重定向到源文件）

### Requirement: dd write target extraction
`extractWriteTargets` SHALL extract the file path from `dd of=<path>` commands.

#### Scenario: dd of= detected
- **WHEN** command is `dd if=/dev/zero of=src/data.bin bs=1024 count=10`
- **THEN** `extractWriteTargets` SHALL return a list containing `src/data.bin`

### Requirement: curl download target extraction
`extractWriteTargets` SHALL extract the file path from `curl -o <path>` and `curl --output <path>` commands.

#### Scenario: curl -o detected
- **WHEN** command is `curl -o src/config.json https://example.com/config`
- **THEN** `extractWriteTargets` SHALL return a list containing `src/config.json`

#### Scenario: curl --output detected
- **WHEN** command is `curl --output lib/data.yaml https://example.com/data`
- **THEN** `extractWriteTargets` SHALL return a list containing `lib/data.yaml`

### Requirement: wget download target extraction
`extractWriteTargets` SHALL extract the file path from `wget -O <path>` and `wget --output-document <path>` commands.

#### Scenario: wget -O detected
- **WHEN** command is `wget -O src/index.html https://example.com`
- **THEN** `extractWriteTargets` SHALL return a list containing `src/index.html`

### Requirement: rsync target extraction
`extractWriteTargets` SHALL extract the last argument from `rsync` commands as the write target.

#### Scenario: rsync detected
- **WHEN** command is `rsync -av src/old.js src/new.js`
- **THEN** `extractWriteTargets` SHALL return a list containing `src/new.js`

### Requirement: install target extraction
`extractWriteTargets` SHALL extract the last argument from `install` commands as the write target.

#### Scenario: install detected
- **WHEN** command is `install -m 755 build/app src/app`
- **THEN** `extractWriteTargets` SHALL return a list containing `src/app`

### Requirement: patch write detection
`isBashWriteCommand` SHALL detect `patch` commands as write operations when the target is a source file or source directory.

#### Scenario: patch detected as write
- **WHEN** command is `patch -p1 < fix.diff`
- **THEN** `isBashWriteCommand` SHALL return `true`

### Requirement: tar extraction detection
`isBashWriteCommand` SHALL detect `tar` extract commands (`tar x`, `tar -x`, `tar xf`, `tar xzf`, `tar --extract`) as write operations.

#### Scenario: tar extract detected as write
- **WHEN** command is `tar xzf archive.tar.gz -C src/`
- **THEN** `isBashWriteCommand` SHALL return `true`

#### Scenario: tar create not detected as write
- **WHEN** command is `tar czf backup.tar.gz src/`
- **THEN** `isBashWriteCommand` SHALL NOT return `true` due to tar detection (may still match other patterns)

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

## MODIFIED Requirements (harness-enforcement-hardening)

### Requirement: fail-open 路径 stderr warning 审计

所有 hook 文件中的 `catch {}` 静默放行块 SHALL 改为输出 stderr warning。warning 格式为 `[WARN] <module>: <brief_description> - <error_message>`。不改变 exit code（仍为 0 放行）。

注意：此 requirement 的实际改动落在 `pre_tool_use.js`、`openspec.js`、`tdd_gate.js` 中的 catch 块，而非 `bash_write_detector.js` 或 `api_key_check.js`（这两个文件当前不含 catch 块）。

#### Scenario: pre_tool_use.js stdin 解析失败
- **WHEN** `JSON.parse(fs.readFileSync("/dev/stdin"))` 抛出异常
- **THEN** SHALL 输出 `[WARN] pre_tool_use: stdin parse failed - <error>` 到 stderr
- **AND** SHALL exit(0)（放行）

#### Scenario: api_key_check 内容提取失败
- **WHEN** `pre_tool_use.js` 中 CONTENT_TOOLS extractor 抛出异常
- **THEN** SHALL 输出 `[WARN] api_key_check: content extraction failed - <error>` 到 stderr
- **AND** SHALL exit(0)（放行）

#### Scenario: openspec.js 状态读取异常
- **WHEN** `getOpenSpecState()` 中 `fs.readdirSync` 或 `fs.existsSync` 抛出异常
- **THEN** SHALL 输出 `[WARN] openspec: state read failed - <error>` 到 stderr
- **AND** SHALL 返回 `{ state: "not_initialized" }`（放行）

#### Scenario: OPENSPEC_SKIP 日志写入失败
- **WHEN** `pre_tool_use.js` 中 OPENSPEC_SKIP 的 appendFileSync 抛出异常
- **THEN** SHALL 输出 `[WARN] openspec_skip: log write failed - <error>` 到 stderr
- **AND** SHALL exit(0)（放行）

#### Scenario: TDD_SKIP 日志写入失败
- **WHEN** `tdd_gate.js` 中 TDD_SKIP 的 appendFileSync 抛出异常
- **THEN** SHALL 输出 `[WARN] tdd_gate: skip log write failed - <error>` 到 stderr
- **AND** SHALL 返回 null（放行）

#### Scenario: git diff 执行失败
- **WHEN** `pre_tool_use.js` 中 `execSync("git diff --cached")` 抛出异常
- **THEN** SHALL 输出 `[WARN] api_key_check: git diff failed - <error>` 到 stderr
- **AND** SHALL 继续执行（不阻断）

### Requirement: warning 格式一致性

所有 fail-open warning SHALL 遵循统一格式：`[WARN] <module_name>: <brief_description> - <error_message>`。其中 `<module_name>` 为产生 warning 的模块标识（如 `pre_tool_use`、`openspec`、`api_key_check`、`tdd_gate`、`openspec_skip`、`change-scope`）。
