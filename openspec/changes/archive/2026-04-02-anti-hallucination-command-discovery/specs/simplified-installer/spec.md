## ADDED Requirements

### Requirement: Installer generates command reference from commands_help

installer 在安装流程中 SHALL 检查 plugin.json 的 `commands_help` 字段。如存在，SHALL 生成 `<plugin-name>-commands.md` markdown 文件，部署到 rules 目标目录（Claude: `~/.claude/rules/`，Codex: `~/.codex/rules/`），并将文件路径加入 managedPaths。

#### Scenario: Generate and deploy command reference

- **WHEN** 安装含 `commands_help` 的插件到 claude 环境
- **THEN** installer SHALL 在 `~/.claude/rules/<plugin-name>-commands.md` 生成命令参考文件
- **AND** 该路径 SHALL 出现在 state 的 managedPaths 中

#### Scenario: Deploy to codex environment

- **WHEN** 安装含 `commands_help` 的插件到 codex 环境
- **THEN** installer SHALL 在 `~/.codex/rules/<plugin-name>-commands.md` 生成命令参考文件

#### Scenario: Uninstall removes generated file

- **WHEN** 卸载插件且 managedPaths 包含 commands.md 路径
- **THEN** 该文件 SHALL 被删除（与其他 managed 文件一致的删除逻辑）

#### Scenario: Idempotent install

- **WHEN** 重复安装同一插件
- **THEN** 命令参考文件 SHALL 被覆盖为最新内容，managedPaths 不重复
