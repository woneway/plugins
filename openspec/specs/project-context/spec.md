## ADDED Requirements

### Requirement: CLAUDE.md 包含项目目标说明
CLAUDE.md SHALL 在文件开头说明项目的核心目标（harness engineering）和设计哲学，使 AI 在进入 session 时建立正确的 mental model。

#### Scenario: AI 读取 CLAUDE.md 后理解项目目标
- **WHEN** AI 在 session 开始时读取 CLAUDE.md
- **THEN** AI 应能识别这是一个 harness engineering 项目，目标是让 AI coding 稳定可靠

### Requirement: CLAUDE.md 包含架构概览
CLAUDE.md SHALL 提供 hook 架构（SessionStart / UserPromptSubmit / PreToolUse）和 OpenSpec 四态门禁的简要说明。

#### Scenario: AI 需要修改 hook 时能找到正确位置
- **WHEN** AI 需要修改某个 hook 行为
- **THEN** AI 应能从 CLAUDE.md 中定位到对应的 hook 文件路径

### Requirement: CLAUDE.md 包含 Commands 章节
CLAUDE.md SHALL 列出常用开发命令，尤其是 reinstall 命令（路径不直觉，易 hallucinate）。

#### Scenario: AI 需要 reinstall 插件时使用正确命令
- **WHEN** AI 修改了 hook 源文件后需要 reinstall
- **THEN** AI 应使用 CLAUDE.md 中列出的正确命令，而非猜测路径

### Requirement: CLAUDE.md 不重复 hook 已覆盖的内容
CLAUDE.md SHALL NOT 包含已由 session-start hook 注入的 skill routing 规则，避免冗余和混淆。

#### Scenario: CLAUDE.md 内容精简
- **WHEN** AI 读取 CLAUDE.md
- **THEN** 文件中不应出现 skill routing 规则（如 "invoke office-hours"、"invoke investigate" 等）
