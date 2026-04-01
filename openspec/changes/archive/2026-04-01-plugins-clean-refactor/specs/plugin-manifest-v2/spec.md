## ADDED Requirements

### Requirement: plugin.json capabilities 对象映射格式

plugin.json 的 capabilities 字段 SHALL 为对象映射格式，每个 key 是 capability 类型（skills/agents/rules/commands），value 是相对于插件根目录的源目录路径。

#### Scenario: 标准 plugin.json 格式

- **WHEN** 插件的 plugin.json 包含 capabilities 对象 `{"skills": "skills/", "agents": "agents/", "rules": "rules/", "commands": "commands/"}`
- **THEN** 安装器 SHALL 识别 4 个 capability 并按声明处理

#### Scenario: 部分 capability 声明

- **WHEN** 插件的 plugin.json 只声明 `{"skills": "skills/", "rules": "rules/"}`
- **THEN** 安装器 SHALL 只安装 skills 和 rules，不处理未声明的 agents 和 commands

#### Scenario: 空 capabilities

- **WHEN** 插件的 plugin.json 的 capabilities 为空对象 `{}`
- **THEN** 安装器 SHALL 不安装任何内容，但仍记录安装状态

### Requirement: plugin.json 不声明 hooks

plugin.json 的 capabilities 中 SHALL NOT 包含 hooks 条目。Hooks 由 Claude Code / Codex 原生插件系统管理。

#### Scenario: hooks 不在 capabilities 中

- **WHEN** 安装器读取 plugin.json
- **THEN** 安装器 SHALL 忽略 hooks/ 目录，不将其安装到目标位置

### Requirement: plugin.json 必需字段

plugin.json MUST 包含 name（string）和 capabilities（object）字段。version 和 description 为可选字段。

#### Scenario: 缺少 name 字段

- **WHEN** plugin.json 没有 name 字段
- **THEN** 安装器 SHALL 抛出错误并提示缺少必需字段

#### Scenario: 缺少 capabilities 字段

- **WHEN** plugin.json 没有 capabilities 字段
- **THEN** 安装器 SHALL 抛出错误并提示缺少必需字段

### Requirement: 不再需要 customInstaller 字段

plugin.json SHALL NOT 使用 customInstaller 字段。安装器 SHALL 忽略该字段。

#### Scenario: 旧格式 plugin.json 包含 customInstaller

- **WHEN** plugin.json 包含 customInstaller 字段
- **THEN** 安装器 SHALL 忽略该字段，按 capabilities 对象映射处理
