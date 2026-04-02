## ADDED Requirements

### Requirement: plugin.json supports optional commands_help field

plugin.json SHALL 支持可选的顶层 `commands_help` 字段。该字段为对象，key 为命令名（kebab-case），value 为包含 `description`（必填）、`usage`（必填）、`when`（可选，纯展示用）的对象。

#### Scenario: Valid commands_help declaration

- **WHEN** plugin.json 包含 `"commands_help": {"reinstall": {"description": "...", "usage": "..."}}`
- **THEN** installer SHALL 识别并处理该字段

#### Scenario: commands_help with when field

- **WHEN** plugin.json 的 commands_help 条目包含 `"when": "After modifying hooks"`
- **THEN** installer SHALL 将 when 字段包含在生成的命令参考文件中（纯展示，无编程语义）

#### Scenario: No commands_help field (backward compatible)

- **WHEN** plugin.json 不含 `commands_help`
- **THEN** installer SHALL 正常安装，不报错，不生成命令文件
