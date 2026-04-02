# common-dev

Codex / Claude Code plugin：OpenSpec 工作流门禁 + API Key 安全保护。

## 统一安装命令

在 `~/ai/plugins` 仓库根目录运行：

```bash
node bin/plugins.js install common-dev --cli codex,claude --env user
node bin/plugins.js update common-dev --cli codex,claude --env user
node bin/plugins.js uninstall common-dev --cli codex,claude --env user
```

参数说明：
- `common-dev` 是插件名，后续可以替换成仓库中的其他 plugin 目录名
- `--cli` 目前支持 `codex`、`claude`
- `--env` 支持 `user` 或 `project`

当前 `common-dev` 分发的能力（由 `plugin.json` 声明）：
- `skills`
- `agents`
- `commands`

安装后另提供 hooks（由 Claude Code / Codex 原生插件系统管理，不在 capabilities 中声明）。

## 安装

### Codex

Codex marketplace 位于：

```text
~/ai/plugins/.agents/plugins/marketplace.json
```

### Claude Code

Claude Code 通过 **marketplace → plugin** 两步机制管理插件。

#### 第一步：注册 marketplace

```bash
# 注册本地 marketplace（只需执行一次）
claude plugin marketplace add ~/ai/plugins
```

注册后可验证：

```bash
claude plugin marketplace list
```

#### 第二步：安装 plugin

```bash
# 全局安装（所有项目生效，推荐）
claude plugin install common-dev -s user

# 项目级安装（仅当前项目生效）
claude plugin install common-dev -s project
```

安装后可验证：

```bash
claude plugin list
```

#### 第三步：安装依赖工具链

```bash
node ~/ai/plugins/bin/plugins.js install common-dev --cli claude,codex --env user
```

自动安装：
- **gstack skills** — 产品层 + 工程质量层 + 设计层
- **ECC agents** (3 个) — tdd-guide、security-reviewer、build-error-resolver
- **OpenSpec commands / skills** — `opsx` commands + OpenSpec workflow skills

#### 第四步（可选）：启用 OpenSpec 变更管理

```bash
npm install -g @fission-ai/openspec@latest
cd /path/to/your-project
openspec init
```

初始化后代码写入强制经 OpenSpec 工作流。未初始化时兼容模式（不拦截）。

## Plugin 管理命令速查

```bash
# marketplace
claude plugin marketplace add <path|github:user/repo>  # 注册
claude plugin marketplace list                          # 查看已注册
claude plugin marketplace remove <name>                 # 移除

# plugin
claude plugin install <name> -s user|project            # 安装
claude plugin list                                      # 查看已安装
claude plugin enable <name>                             # 启用
claude plugin disable <name>                            # 禁用
claude plugin update <name>                             # 更新
claude plugin uninstall <name>                          # 卸载
claude plugin validate <path>                           # 验证 manifest

# 临时加载（不安装，仅当次会话）
claude --plugin-dir ~/ai/plugins/common-dev
```

## 工作原理

### Hook 架构

```
SessionStart
  └─ session_start.js        检测环境，注入三层架构提示

UserPromptSubmit
  └─ user_prompt_submit.js    意图分类 + 阶段感知引导

PreToolUse (Bash/Edit/Write/MultiEdit)
  └─ pre_tool_use.js          编排器
      ├─ lib/api_key_check.js       [SECURITY] API Key 检测
      ├─ lib/bash_write_detector.js  Bash 写操作识别
      └─ lib/openspec.js            [WORKFLOW] OpenSpec 状态机
```

### OpenSpec 四态门禁

| 状态 | 条件 | 行为 |
|------|------|------|
| `not_initialized` | 无 `openspec/` 目录 | 放行（兼容模式） |
| `no_active_change` | 有 `openspec/changes/` 但无活跃变更 | 阻断 |
| `planning` | 有变更但无 `tasks.md` | 阻断 |
| `ready_to_apply` | 有变更且有 `tasks.md` | 放行 |

## 紧急豁免

```bash
OPENSPEC_SKIP=1 claude
```

写入不受门禁拦截，但操作记录到 `.claude/openspec-skip-log.jsonl`。

## 开发

```bash
cd ~/ai/plugins/common-dev
npm install
npm test                         # 运行测试
npx jest --verbose --coverage    # 详细输出 + 覆盖率
```
