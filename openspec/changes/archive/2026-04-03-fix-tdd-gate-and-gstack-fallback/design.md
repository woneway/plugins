## Context

TDD gate (`lib/tdd_gate.js`) 的白名单当前只认 JS/TS 生态的测试文件模式。当用户在非 JS/TS 项目中使用 common-dev 插件时（如 Java、Python、Go 项目），测试文件会被误判为实现代码而阻断。

同时，skills 的 SKILL.md 模板中引用了 gstack 工具链命令（`gstack-learnings-log`、`gstack-review-log` 等），这些命令在 gstack 未安装时 exit 127 报错。大部分 gstack 调用已有 `2>/dev/null || true` fallback，但 `{{LEARNINGS_LOG}}` 模板段中的指令文本直接告诉 AI 运行裸命令，没有 existence check。

## Goals / Non-Goals

**Goals:**
- TDD gate 白名单支持主流语言的测试文件约定（Java、Python、Go、Ruby、Rust、C#）
- TDD gate 白名单支持通用测试目录模式（`src/test/`、`tests/`、`test/`、`spec/`）
- 现有 JS/TS 行为不变，所有现有测试继续通过

**Non-Goals:**
- 不改变 TDD gate 的核心逻辑（仅扩展白名单）
- 不修复 Bash 写操作中 shell 变量（`$TMPF`）无法展开的问题（这是 bash_write_detector 的已知限制，scope 太大）
- gstack fallback 修复推迟到后续变更（本次聚焦 TDD gate，gstack 问题影响面大需要单独评估 SKILL.md.tmpl 模板引擎）

## Decisions

### D1: 白名单扩展方式 — 添加正则模式

在 `WHITELIST_PATTERNS` 数组中追加多语言测试文件模式，而非改用复杂的 AST 或配置文件方案。

**理由**：当前白名单就是正则数组，保持一致性。正则模式对测试文件命名约定足够精确。

### D2: 测试目录模式用路径前缀匹配

添加 `src/test/`、`tests/`、`test/`、`spec/` 等目录前缀模式，对 normalized 路径做匹配。

**理由**：Java（Maven/Gradle）的 `src/test/` 是标准约定；Python 的 `tests/`、Ruby 的 `spec/` 同理。目录级匹配比文件名匹配更可靠。

### D3: isWhitelisted 中同时检查 basename 和 normalized path

当前 `isWhitelisted` 已对每个 pattern 同时 test basename 和 normalized path。目录模式（如 `/src\/test\//`）只会匹配 normalized path，文件名模式只会匹配 basename。无需改动函数结构。

## Risks / Trade-offs

- **[过度放行]** 添加 `src/test/` 等目录模式可能放行非测试文件（如测试资源配置文件）→ 可接受，这些文件本身也不需要 TDD gate 检查
- **[遗漏语言]** 无法穷举所有语言的测试约定 → 用户可通过 `TDD_SKIP=1` 豁免；后续可按需追加
