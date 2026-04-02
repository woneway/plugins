## Context

AI 在执行 CLI 命令时频繁编造不存在的命令路径和参数。当前 common-dev 插件有 hook 基础设施（PreToolUse、UserPromptSubmit、SessionStart）但没有"命令发现"机制。设计文档详见 `~/.gstack/projects/woneway-plugins/lianwu-main-design-20260402-120000.md`（APPROVED）。

## Goals / Non-Goals

**Goals:**

- 让 AI 在每次对话中都能看到插件声明的正确命令（通过 rules 文件）
- 引导 AI 在执行项目命令前先查 CLAUDE.md/package.json
- 引导 AI 在执行外部工具命令前先验证（--help / which / 搜索）
- installer 自动从 plugin.json 的 commands_help 生成命令参考文件

**Non-Goals:**

- 不做 hook 拦截（误报风险太高）
- 不做 Makefile/package.json 自动扫描（过度工程化）
- 不做路径模板解析（v1 用硬编码路径）

## Decisions

### Decision 1: 全局 rule 文件作为 Layer 1

**选择：** 添加 `common-dev/rules/verify-commands.md` 静态文件，通过现有 capabilities.rules 机制部署。

**为什么不用 hook：** hook 只能拦截 Bash 工具调用，无法在 AI "生成命令"阶段介入。而且管道/子shell/动态路径会导致大量误报。Rule 在对话开始时就被 AI 读取，直接影响命令生成行为。

### Decision 2: commands_help 作为 plugin.json 顶层字段

**选择：** `commands_help` 与 `capabilities` 并列，不嵌套在 capabilities 内。

**原因：** `capabilities` 映射目录做文件复制；`commands_help` 是结构化声明触发代码生成。机制不同，语义不同。

### Decision 3: installer 生成 markdown 文件部署到 rules/

**选择：** installer 读取 `commands_help`，生成 `<plugin-name>-commands.md`，写入 rules 目标目录，加入 managedPaths。

**为什么不写入 CLAUDE.md：** CLAUDE.md 是项目级文件，不应被全局插件修改。rules/ 是用户级配置，每次对话自动加载。

## Risks / Trade-offs

**[Risk] AI 可能忽略 rule 文件中的指导** → 这是"建议"不是"强制"。但实测中 rules 文件的遵循率很高，因为每次对话都会加载。如果不够，后续可以加 hook 层。

**[Risk] 硬编码路径在 repo 位置变更时失效** → v1 接受这个限制。用户重装插件即可修复。后续可加模板解析。
