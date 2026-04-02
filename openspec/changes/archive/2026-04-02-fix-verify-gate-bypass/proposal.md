## Problem

Codex adversarial review found 4 bugs in verify_gate, including a critical main-path failure:

1. **CRITICAL**: `isBashWriteCommand('mv openspec/changes/X openspec/changes/archive/Y')` returns `false`. The hook exits at `pre_tool_use.js:103` before reaching `checkVerifyGate()`. The gate never fires on the exact command it was built to intercept.

2. **HIGH**: Malformed `.verify-state.json` (e.g. `{}`, `{"result":"garbage"}`) bypasses the gate. Only `result==="warn" && !userConfirmed` is blocked; everything else passes.

3. **HIGH**: Regex too narrow. `./openspec/changes/...`, quoted paths, and `command mv` variants all bypass pattern matching.

4. **MEDIUM-HIGH**: Git unavailable = fail-open. When `git rev-parse --short HEAD` fails, freshness check is skipped entirely.

## Solution

- Move verify_gate check in `pre_tool_use.js` to run BEFORE `isWriteOperation()` — it's an independent gate, not a write-path sub-check
- Validate required fields in state file (result, commit must exist and be valid)
- Normalize command before regex matching (strip `./`, quotes, leading `command`)
- Fail-closed when git is unavailable
