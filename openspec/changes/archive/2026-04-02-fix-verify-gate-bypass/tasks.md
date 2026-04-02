## Tasks

- [x] 1. Fix pre_tool_use.js: move verify_gate check before isWriteOperation() gate
- [x] 2. Fix verify_gate.js: validate required fields (result, commit) in state file
- [x] 3. Fix verify_gate.js: normalize command before regex (strip `./`, quotes, `command` prefix)
- [x] 4. Fix verify_gate.js: fail-closed when git unavailable
- [x] 5. Add integration test: archive mv command triggers verify_gate in pre_tool_use flow
- [x] 6. Add unit tests for new validation and normalization logic
- [x] 7. Run full test suite, verify no regressions (158/158 pass)
