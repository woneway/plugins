## ADDED Requirements

### Requirement: TDD gate 阻断无测试的实现文件写操作
`lib/tdd_gate.js` SHALL 在 OpenSpec 状态为 `ready_to_apply` 时，检测写操作目标是否为实现文件。若目标为实现文件且无对应测试文件存在，SHALL 阻断并提示先写测试。

#### Scenario: 写实现文件但无对应测试文件
- **WHEN** 写操作目标为 `lib/foo.js` 且 `__tests__/foo.test.js` 和 `lib/foo.test.js` 均不存在
- **THEN** hook SHALL 阻断并输出包含 `[TDD]` 前缀的提示信息

#### Scenario: 写实现文件且对应测试文件存在
- **WHEN** 写操作目标为 `lib/foo.js` 且 `__tests__/foo.test.js` 存在
- **THEN** hook SHALL 放行

#### Scenario: 写测试文件本身
- **WHEN** 写操作目标匹配以下任一模式，hook SHALL 放行（测试文件不受 TDD gate 约束）：
  - JS/TS: `*.test.[jt]sx?`、`*.spec.[jt]sx?`、`__tests__/**`
  - Java: `*Test.java`、`*Tests.java`、`*IT.java`、`src/test/**`
  - Python: `test_*.py`、`*_test.py`
  - Go: `*_test.go`
  - Ruby: `*_spec.rb`
  - Rust: 路径包含 `/tests/`（Rust integration tests 目录）
  - C#: `*Tests.cs`、`*Test.cs`
  - 通用测试目录: `tests/`、`test/`、`spec/`、`__tests__/`
- **THEN** hook SHALL 放行

#### Scenario: 写配置文件
- **WHEN** 写操作目标为 `package.json`、`*.config.js`、`*.config.ts`、`.eslintrc*`、`.prettierrc*`
- **THEN** hook SHALL 放行

#### Scenario: 写文档文件
- **WHEN** 写操作目标匹配 `*.md`
- **THEN** hook SHALL 放行

#### Scenario: 写资源文件
- **WHEN** 写操作目标匹配 `*.json`、`*.yaml`、`*.yml`、`*.d.ts`
- **THEN** hook SHALL 放行

### Requirement: TDD gate 仅在 ready_to_apply 状态激活
TDD gate SHALL 仅在 OpenSpec 状态为 `ready_to_apply` 时执行检查。其他状态（`not_initialized`、`no_active_change`、`planning`）SHALL 放行。

#### Scenario: OpenSpec 未初始化
- **WHEN** OpenSpec 状态为 `not_initialized`
- **THEN** TDD gate SHALL 放行，不做任何检查

#### Scenario: OpenSpec 状态为 ready_to_apply
- **WHEN** OpenSpec 状态为 `ready_to_apply` 且写操作目标为无测试的实现文件
- **THEN** TDD gate SHALL 阻断

### Requirement: TDD_SKIP 环境变量豁免
当环境变量 `TDD_SKIP=1` 时，TDD gate SHALL 放行所有写操作，并将跳过记录写入日志文件。

#### Scenario: TDD_SKIP=1 设置时放行
- **WHEN** `TDD_SKIP=1` 且写操作目标为无测试的实现文件
- **THEN** hook SHALL 放行，并将操作详情追加到 `.claude/tdd-skip-log.jsonl`

#### Scenario: TDD_SKIP 未设置时正常检查
- **WHEN** `TDD_SKIP` 环境变量未设置
- **THEN** hook SHALL 正常执行 TDD gate 检查

### Requirement: 测试文件匹配规则
对于实现文件 `<dir>/<name>.js`，TDD gate SHALL 按以下顺序查找对应测试文件，任一存在即视为"有测试"：
1. `<dir>/__tests__/<name>.test.js`
2. `<dir>/<name>.test.js`
3. `<dir>/<name>.spec.js`

#### Scenario: 测试文件在 __tests__ 子目录
- **WHEN** 实现文件为 `hooks/lib/tdd_gate.js` 且 `hooks/lib/__tests__/tdd_gate.test.js` 存在
- **THEN** SHALL 视为有测试，放行

#### Scenario: 测试文件在同级目录
- **WHEN** 实现文件为 `hooks/lib/tdd_gate.js` 且 `hooks/lib/tdd_gate.test.js` 存在
- **THEN** SHALL 视为有测试，放行

#### Scenario: 嵌套 __tests__ 目录（hooks 项目结构）
- **WHEN** 实现文件为 `hooks/pre_tool_use.js` 且 `hooks/__tests__/pre_tool_use.test.js` 存在
- **THEN** SHALL 视为有测试，放行

### Requirement: Bash 写命令的 TDD gate 检查
当 Bash 命令被识别为写操作时，TDD gate SHALL 提取写操作目标路径并对每个目标执行测试文件存在性检查。

#### Scenario: Bash 写命令目标无测试
- **WHEN** Bash 命令写目标为实现文件且无对应测试文件
- **THEN** hook SHALL 阻断

#### Scenario: Bash 写命令目标为白名单文件
- **WHEN** Bash 命令写目标为配置文件或文档
- **THEN** hook SHALL 放行
