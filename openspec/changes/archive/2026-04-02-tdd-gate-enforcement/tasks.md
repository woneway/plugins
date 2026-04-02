## 1. Core Module

- [x] 1.1 Create `lib/tdd_gate.js` — checkTddGate(filePath, repoRoot, openspecState) 主函数
- [x] 1.2 Implement whitelist logic: test files, config, docs, resources, bin/
- [x] 1.3 Implement test file lookup: `__tests__/<name>.test.js`, `<name>.test.js`, `<name>.spec.js`
- [x] 1.4 Implement TDD_SKIP=1 bypass with jsonl logging

## 2. Hook Integration

- [x] 2.1 Wire tdd_gate into `pre_tool_use.js` as step 6 (after OpenSpec gate, before exit 0)
- [x] 2.2 Handle Edit/Write/MultiEdit/NotebookEdit tool — extract file_path, call checkTddGate
- [x] 2.3 Handle Bash tool — use extractWriteTargets(), call checkTddGate for each target

## 3. Tests

- [x] 3.1 Unit tests for `tdd_gate.js`: whitelist patterns (test files, config, docs, resources)
- [x] 3.2 Unit tests for `tdd_gate.js`: test file lookup logic (all three search paths)
- [x] 3.3 Unit tests for `tdd_gate.js`: TDD_SKIP bypass and logging
- [x] 3.4 Unit tests for `tdd_gate.js`: only activates on ready_to_apply state
- [x] 3.5 Integration tests in `pre_tool_use.test.js`: TDD gate blocks impl without test
- [x] 3.6 Integration tests in `pre_tool_use.test.js`: TDD gate passes when test exists

## 4. Verify

- [x] 4.1 Run full test suite, verify no regressions (188/188 pass)
