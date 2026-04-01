## ADDED Requirements

### Requirement: NotebookEdit triggers PreToolUse hook
hooks.json SHALL include a PreToolUse matcher for the `NotebookEdit` tool, pointing to the same `pre_tool_use.js` command as other write tools.

#### Scenario: NotebookEdit write is gated by OpenSpec workflow
- **WHEN** NotebookEdit is invoked with a `file_path` targeting a source file
- **AND** OpenSpec state is `no_active_change` or `planning`
- **THEN** pre_tool_use.js SHALL exit with code 2 and display the workflow block message

#### Scenario: NotebookEdit write to openspec directory is allowed
- **WHEN** NotebookEdit is invoked with a `file_path` inside the `openspec/` directory
- **THEN** pre_tool_use.js SHALL exit with code 0 (allow)

### Requirement: NotebookEdit recognized as write operation
`isWriteOperation()` in pre_tool_use.js SHALL return `true` when `toolName` is `"NotebookEdit"`.

#### Scenario: NotebookEdit classified as write
- **WHEN** pre_tool_use.js receives tool_name `"NotebookEdit"`
- **THEN** `isWriteOperation()` SHALL return `true`
