## 项目目标

这是一个 **harness engineering** 项目。

**目标**：让 AI coding agent 做到稳定、可靠的 coding。

**设计哲学**：AI 是引擎，但引擎本身不能上路——你需要底盘、方向盘、刹车。这个项目造的是这套底盘：
- OpenSpec 门禁 → 方向盘（强制规划-实施流程，防止 AI 想到就做）
- hooks 拦截 → 刹车（在危险动作发生前介入）
- anti-hallucination → 导航（先发现再执行，不靠记忆猜命令）
- API key / 安全检测 → 安全带（兜底保护）

目标不是限制 AI，而是让 AI 的能力可以被**工程化地信任**。

## 架构概览

```
SessionStart
  └─ common-dev/hooks/session_start.js     检测环境，注入三层架构提示

UserPromptSubmit
  └─ common-dev/hooks/user_prompt_submit.js 意图分类 + OpenSpec 状态感知引导

PreToolUse (Bash/Edit/Write/MultiEdit)
  └─ common-dev/hooks/pre_tool_use.js       编排器
      ├─ lib/api_key_check.js               [SECURITY] API Key 检测
      ├─ lib/bash_write_detector.js         Bash 写操作识别
      └─ lib/openspec.js                    [WORKFLOW] OpenSpec 状态机
```

**OpenSpec 四态门禁**：

| 状态 | 条件 | 行为 |
|------|------|------|
| `not_initialized` | 无 `openspec/` 目录 | 放行（兼容模式） |
| `no_active_change` | 有 `openspec/changes/` 但无活跃变更 | 阻断 |
| `planning` | 有变更但无 `tasks.md` | 阻断 |
| `ready_to_apply` | 有变更且有 `tasks.md` | 放行 |

## Commands

### reinstall（修改 hook 源文件后必须执行）

```bash
node ~/ai/plugins/bin/plugins.js install common-dev --cli claude,codex --env user
```

### uninstall

```bash
node ~/ai/plugins/bin/plugins.js uninstall common-dev --cli claude,codex --env user
```

### test

```bash
cd ~/ai/plugins/common-dev && npm test
```
