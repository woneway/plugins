## MODIFIED Requirements

### Requirement: 写测试文件本身
- **WHEN** 写操作目标匹配以下任一模式，hook SHALL 放行（测试文件不受 TDD gate 约束）：
  - JS/TS: `*.test.[jt]sx?`、`*.spec.[jt]sx?`、`__tests__/**`
  - Java: `*Test.java`、`*Tests.java`、`*IT.java`、`src/test/**`
  - Python: `test_*.py`、`*_test.py`
  - Go: `*_test.go`
  - Ruby: `*_spec.rb`
  - Rust: 路径包含 `/tests/`（Rust integration tests 目录）
  - C#: `*Tests.cs`、`*Test.cs`
  - 通用测试目录: `tests/`、`test/`、`spec/`、`__tests__/`

#### Scenario: Java 测试文件在 src/test/ 目录
- **WHEN** 写操作目标为 `src/test/java/com/example/FooTest.java`
- **THEN** hook SHALL 放行

#### Scenario: Java 测试文件以 Test 结尾
- **WHEN** 写操作目标为 `FooTest.java`
- **THEN** hook SHALL 放行

#### Scenario: Java 集成测试文件以 IT 结尾
- **WHEN** 写操作目标为 `FooIT.java`
- **THEN** hook SHALL 放行

#### Scenario: Python 测试文件以 test_ 开头
- **WHEN** 写操作目标为 `test_foo.py`
- **THEN** hook SHALL 放行

#### Scenario: Python 测试文件以 _test 结尾
- **WHEN** 写操作目标为 `foo_test.py`
- **THEN** hook SHALL 放行

#### Scenario: Go 测试文件
- **WHEN** 写操作目标为 `foo_test.go`
- **THEN** hook SHALL 放行

#### Scenario: Ruby spec 文件
- **WHEN** 写操作目标为 `foo_spec.rb`
- **THEN** hook SHALL 放行

#### Scenario: Rust integration tests 目录
- **WHEN** 写操作目标路径包含 `tests/test_integration.rs`
- **THEN** hook SHALL 放行

#### Scenario: C# 测试文件
- **WHEN** 写操作目标为 `FooTests.cs` 或 `FooTest.cs`
- **THEN** hook SHALL 放行

#### Scenario: 通用 tests/ 目录
- **WHEN** 写操作目标路径以 `tests/` 开头
- **THEN** hook SHALL 放行

#### Scenario: 通用 test/ 目录
- **WHEN** 写操作目标路径以 `test/` 开头
- **THEN** hook SHALL 放行

#### Scenario: JS/TS 测试文件仍然放行
- **WHEN** 写操作目标为 `foo.test.js`
- **THEN** hook SHALL 放行（向后兼容）
