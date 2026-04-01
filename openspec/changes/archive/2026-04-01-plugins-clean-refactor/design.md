## Context

plugins 项目是一个插件分发框架，将 skills、agents、rules、commands 安装到 Claude Code 和 Codex 的配置目录。当前架构存在三层混乱：

1. common-dev/sources/ 下有 gstack、ecc、openspec、custom 四个来源目录，安装器需要理解每个来源的结构
2. 安装流程分两步（refresh-source 从上游快照 + install 部署快照），还需要 marketplace 注册
3. 自定义安装器 scripts/setup.js（531 行）和框架安装器 lib/installer.js 职责重叠

设计文档已经过 /office-hours 和 /plan-eng-review 审查，关键架构决策已确认。
参考：~/.gstack/projects/plugins/lianwu-security-hardening-p0-design-20260401-200000.md

## Goals / Non-Goals

**Goals:**
- plugin.json 新协议：capabilities 为对象映射，安装器按声明遍历目录复制
- 安装器简化：只支持 install/uninstall，只支持 copy 模式
- common-dev 目录结构标准化：sources/ 平铺到 skills/、agents/、rules/、commands/
- `plugins install common-dev --cli claude --env user` 一条命令完成安装
- 安装器代码 < 400 行（当前 ~670 行）

**Non-Goals:**
- 不做更新能力（refresh-source / update action）
- 不做 hooks 安装（由 Claude Code / Codex 原生插件系统管理）
- 不做 marketplace 注册自动化
- 不做多插件命名空间隔离
- 不做 mcp capability

## Decisions

### D1: Hooks 由原生插件系统管理，安装器不参与

**选择**: hooks/ 和 .claude-plugin/ / .codex-plugin/ 保留给 Claude Code / Codex 原生运行时。安装器的 plugin.json 不声明 hooks capability。

**替代方案**: 安装器接管 hooks 安装（复制 hooks 到 ~/.claude/hooks/ 并合并 hooks.json）。

**理由**: hooks 加载依赖 $CLAUDE_PLUGIN_ROOT 环境变量，这个变量由原生运行时设置。安装器接管会引入路径改写、hooks.json 合并等复杂逻辑，而当前 hooks 工作正常，不需要改。

### D2: Skills 直接安装，不加插件命名空间

**选择**: skills 安装到 ~/.claude/skills/<skill-name>/，不加 <plugin-name>/ 前缀。

**替代方案**: ~/.claude/skills/<plugin-name>/<skill-name>/。

**理由**: gstack skills 内部引用 ~/.claude/skills/gstack/[skill-name]/SKILL.md 和 ~/.claude/skills/gstack/bin/ 等共享资源。这些路径由 gstack 原始安装（非本插件）提供。本插件只负责复制 skill 目录到 ~/.claude/skills/<skill-name>/，gstack 运行时自行解析 gstack/ 前缀路径。加插件命名空间会和 gstack 原始安装路径冲突。当前只有一个插件，命名冲突风险为零。

**注意**: 本插件安装的 gstack skills 依赖 gstack 原始安装提供的 bin/、browse/、ETHOS.md 等共享资源（位于 ~/.claude/skills/gstack/）。如果用户没有安装 gstack 本身，这些 skills 可能无法正常工作。

### D3: 统一 copy 模式，删除 symlink

**选择**: 所有内容统一用文件复制安装。

**替代方案**: 保留 symlink 选项（更新时源文件变了就生效）。

**理由**: 本次不做更新能力，copy 的劣势（更新需要重装）不是问题。统一 copy 简化安装器逻辑，卸载时 hash 验证更可靠。

### D4: CLI 参数默认值

**选择**: --cli 默认 claude，--env 默认 user。

**理由**: 最常用场景是 `plugins install common-dev`（安装到 claude user 作用域），省去每次都要打完整参数。

### D5: 安装器按 capability 遍历目录

**选择**: 安装器读 plugin.json 的 capabilities 对象，对每个条目（如 `"skills": "skills/"`），将源目录下的每个子项复制到目标位置。

**安装目标路径**:
```
skills/<skill-name>/   → ~/.claude/skills/<skill-name>/
agents/<agent-file>    → ~/.claude/agents/<agent-file>
rules/<rule-file>      → ~/.claude/rules/<rule-file>
commands/<cmd-dir>/    → ~/.claude/commands/<cmd-dir>/
```

## Risks / Trade-offs

- **[Risk] gstack skill 文件量大（88 个文件）** → 每次 install 复制 88 个文件，磁盘 I/O 在毫秒级，可接受
- **[Risk] 旧 symlink 安装残留** → 重构前先用当前代码执行 uninstall 清理旧安装，再切换新安装器
- **[Risk] plugin.json 破坏性变更** → 只有 common-dev 一个插件，直接更新，无迁移成本
- **[Trade-off] 不做更新能力** → 手动更新源文件后需要重新 install。当前可接受，未来加更新能力时再优化
