## MODIFIED Requirements

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
