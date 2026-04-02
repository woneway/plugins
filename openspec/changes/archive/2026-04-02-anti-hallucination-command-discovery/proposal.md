## Why

AI 编造 CLI 命令（猜路径、猜参数、猜子命令），根因是没有任何机制提醒它先查找正确命令。通过 common-dev 插件的 rules 部署能力，让正确命令始终对 AI 可见，从源头消灭编造行为。

## What Changes

- 新增全局 rule `verify-commands.md`，安装到 `~/.claude/rules/` 和 `~/.codex/rules/`，指导 AI 在执行命令前先查找验证
- 在 plugin.json 中新增 `commands_help` 字段，插件可声明自己的 CLI 命令（用法、描述、使用场景）
- 修改 installer，安装时从 `commands_help` 自动生成 `<plugin-name>-commands.md` 并部署到 rules 目录
- 为 common-dev 添加 `commands_help` 声明（reinstall / uninstall 命令）

## Capabilities

### New Capabilities

- `command-discovery`: 全局规则 + 插件命令声明 + installer 命令文件生成机制

### Modified Capabilities

- `plugin-manifest-v2`: plugin.json 新增可选的 `commands_help` 顶层字段
- `simplified-installer`: installer 安装流程新增 commands_help → 生成 markdown → 部署到 rules/ → 记入 managedPaths

## Impact

- 受影响文件：`lib/installer.js`（新增命令文件生成逻辑）、`common-dev/plugin.json`（新增 commands_help）、新文件 `common-dev/rules/verify-commands.md`
- 不影响现有 API 或 hook 机制
- 向后兼容：无 `commands_help` 字段的插件行为不变
