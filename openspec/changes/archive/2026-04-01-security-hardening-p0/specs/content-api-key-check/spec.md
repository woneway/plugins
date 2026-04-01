## ADDED Requirements

### Requirement: Write tool content checked for API keys
When the `Write` tool is invoked, pre_tool_use.js SHALL extract `tool_input.content` and call `checkApiKeyInContent`. If a key is detected, the hook SHALL exit with code 2 and display a security warning.

#### Scenario: Write with hardcoded API key blocked
- **WHEN** Write is invoked with `content` containing `sk-proj-abcdefghijklmnopqrstuvwx`
- **THEN** hook SHALL exit with code 2
- **AND** stderr SHALL contain `[SECURITY]` and mention hardcoded API Key

#### Scenario: Write with clean content allowed
- **WHEN** Write is invoked with `content` containing no API key patterns
- **THEN** hook SHALL NOT block due to API key check (may still be blocked by OpenSpec gate)

### Requirement: Edit tool content checked for API keys
When the `Edit` tool is invoked, pre_tool_use.js SHALL extract `tool_input.new_string` and call `checkApiKeyInContent`. If a key is detected, the hook SHALL exit with code 2.

#### Scenario: Edit with hardcoded API key blocked
- **WHEN** Edit is invoked with `new_string` containing `AKIA1234567890ABCDEF`
- **THEN** hook SHALL exit with code 2

### Requirement: MultiEdit tool content checked for API keys
When the `MultiEdit` tool is invoked, pre_tool_use.js SHALL concatenate all `tool_input.edits[].new_string` values and call `checkApiKeyInContent` on the combined text. If a key is detected, the hook SHALL exit with code 2.

#### Scenario: MultiEdit with hardcoded API key in one edit blocked
- **WHEN** MultiEdit is invoked with `edits` array where one entry's `new_string` contains `ghp_abcdefghijklmnopqrstuvwxyz1234567890`
- **THEN** hook SHALL exit with code 2

### Requirement: NotebookEdit tool content checked for API keys
When the `NotebookEdit` tool is invoked, pre_tool_use.js SHALL extract `tool_input.new_source` and call `checkApiKeyInContent`. If a key is detected, the hook SHALL exit with code 2.

#### Scenario: NotebookEdit with hardcoded API key blocked
- **WHEN** NotebookEdit is invoked with `new_source` containing `a Slack bot token matching the xoxb- prefix pattern`
- **THEN** hook SHALL exit with code 2

### Requirement: API key check runs before OpenSpec gate
The content API key check SHALL run before the OpenSpec workflow gate, so that API keys are blocked even when OpenSpec state is `ready_to_apply` or `not_initialized`.

#### Scenario: API key blocked even in ready_to_apply state
- **WHEN** OpenSpec state is `ready_to_apply`
- **AND** Write is invoked with content containing a hardcoded API key
- **THEN** hook SHALL exit with code 2 (API key block takes priority)

### Requirement: Content check excludes comments and example files
`checkApiKeyInContent` SHALL skip lines that are comments (`#`, `//`) or contain `.example`, consistent with existing `isExcludedLine` behavior.

#### Scenario: API key in comment line not flagged
- **WHEN** Write is invoked with content `// API_KEY="sk-test12345678901234567890"`
- **THEN** hook SHALL NOT block due to API key check
