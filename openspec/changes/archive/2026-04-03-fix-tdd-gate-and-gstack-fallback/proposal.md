## Why

TDD gate 白名单仅识别 JS/TS 测试文件模式（`.test.[jt]sx?`、`__tests__/`），导致 Java（`src/test/`、`*Test.java`）、Python（`test_*.py`）、Go（`*_test.go`）等语言的测试文件被误判为实现代码而阻断。同时，skills 中 gstack 工具链命令（`gstack-learnings-log`、`gstack-review-log` 等）在未安装时直接报错 exit 127，缺乏 graceful fallback。

## What Changes

- 扩展 `tdd_gate.js` 白名单，增加多语言测试文件识别模式（Java、Python、Go、Ruby、Rust、C#）
- 扩展 `tdd_gate.js` 白名单，增加 `src/test/` 和 `tests/` 等通用测试目录模式
- 修复 SKILL.md.tmpl 模板中 gstack 命令缺少 fallback 的位置，确保 gstack 未安装时静默跳过

## Capabilities

### New Capabilities

_(无新能力)_

### Modified Capabilities

- `tdd-gate`: 白名单扩展，增加多语言测试文件和测试目录的识别规则

## Impact

- `common-dev/hooks/lib/tdd_gate.js` — 白名单正则扩展
- `common-dev/hooks/__tests__/tdd_gate.test.js` — 新增多语言场景测试用例
- `common-dev/skills/*/SKILL.md.tmpl` 及 `SKILL.md` — gstack 命令 fallback 修复
- 现有测试必须继续通过
