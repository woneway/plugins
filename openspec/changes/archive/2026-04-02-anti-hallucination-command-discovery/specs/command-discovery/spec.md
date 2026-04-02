## ADDED Requirements

### Requirement: Global verify-commands rule

common-dev 插件 SHALL 包含 `rules/verify-commands.md` 静态规则文件，通过 capabilities.rules 机制部署到 `~/.claude/rules/` 和 `~/.codex/rules/`。

#### Scenario: Rule file deployed on install

- **WHEN** 用户执行 `plugins install common-dev --cli claude --env user`
- **THEN** `~/.claude/rules/verify-commands.md` SHALL 存在且内容包含项目命令查找指导和外部命令验证指导

#### Scenario: Rule content covers project commands

- **WHEN** AI 读取 `verify-commands.md`
- **THEN** 规则 SHALL 指导 AI 在执行项目命令前检查 CLAUDE.md、package.json scripts、Makefile targets

#### Scenario: Rule content covers external commands

- **WHEN** AI 读取 `verify-commands.md`
- **THEN** 规则 SHALL 指导 AI 对不确定的外部命令使用 `--help`、`which`、或联网搜索验证

### Requirement: Plugin commands_help generates discoverable command reference

安装含 `commands_help` 的插件时，installer SHALL 自动生成 `<plugin-name>-commands.md` 文件并部署到 rules 目录，使 AI 在每次对话中都能看到正确的命令用法。

#### Scenario: commands_help generates markdown file

- **WHEN** plugin.json 包含 `commands_help` 字段，且用户执行 install
- **THEN** installer SHALL 在 rules 目标目录生成 `<plugin-name>-commands.md`，内容包含每个命令的 description、usage、when（如有）

#### Scenario: Generated file tracked for uninstall

- **WHEN** installer 生成了 `<plugin-name>-commands.md`
- **THEN** 该文件路径 SHALL 被加入 `managedPaths`，卸载时自动删除

#### Scenario: No commands_help field

- **WHEN** plugin.json 不含 `commands_help` 字段
- **THEN** installer SHALL 不生成命令文件，行为与当前一致（向后兼容）

#### Scenario: Multiple plugins no collision

- **WHEN** 两个插件（plugin-a 和 plugin-b）都有 `commands_help`
- **THEN** installer SHALL 分别生成 `plugin-a-commands.md` 和 `plugin-b-commands.md`，互不覆盖
