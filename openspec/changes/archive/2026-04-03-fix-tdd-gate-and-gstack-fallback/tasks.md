## 1. TDD Gate 白名单扩展

- [x] 1.1 在 `common-dev/hooks/lib/tdd_gate.js` 的 `WHITELIST_PATTERNS` 数组中添加多语言测试文件模式：Java (`Test.java`, `Tests.java`, `IT.java`), Python (`test_*.py`, `*_test.py`), Go (`*_test.go`), Ruby (`*_spec.rb`), Rust, C# (`Tests.cs`, `Test.cs`)
- [x] 1.2 在 `WHITELIST_PATTERNS` 中添加通用测试目录模式：`src/test/`, `tests/`, `test/`, `spec/`

## 2. 测试用例

- [x] 2.1 在 `common-dev/hooks/__tests__/tdd_gate.test.js` 中添加多语言测试文件白名单测试用例（Java、Python、Go、Ruby、Rust、C#）
- [x] 2.2 在测试中添加通用测试目录模式的测试用例
- [x] 2.3 运行 `npm test` 确认所有现有测试和新测试通过
