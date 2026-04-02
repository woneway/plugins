## Why

当前 CLAUDE.md 只包含 skill routing 规则，但这些规则对其他项目无意义（其他项目不会读取此文件）。CLAUDE.md 应该为项目目标服务：让在这个 repo 上工作的 AI 理解这是一个 **harness engineering** 项目，并据此做出正确的工程决策。

## What Changes

- 移除无意义的 skill routing 规则（已在 session-start hook 中覆盖，无需重复）
- 添加项目目标说明：harness engineering 的定义和设计哲学
- 添加架构概览：三层 hook 结构、OpenSpec 四态门禁
- 添加开发规范：Commands、测试、reinstall 流程

## Capabilities

### New Capabilities

- `project-context`: CLAUDE.md 中的项目上下文说明——目标、架构、开发规范

### Modified Capabilities

（无现有 spec 需要修改）

## Impact

- 仅影响 `/Users/lianwu/ai/plugins/CLAUDE.md` 一个文件
- 不影响任何代码逻辑
- 让未来所有在此 repo 工作的 AI session 更快理解项目背景
