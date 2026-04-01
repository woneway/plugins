## Context

common-dev 是一个 Claude Code 插件，通过 hooks.json 注册 PreToolUse 钩子，在 AI 执行写操作前进行两层检查：API Key 硬编码检测和 OpenSpec 工作流门禁。当前实现有三个安全盲区（详见 proposal.md），均为覆盖面不足而非逻辑错误。

现有架构：
- `hooks.json` → 工具匹配器，决定哪些工具触发钩子
- `pre_tool_use.js` → 编排器，串联检查逻辑
- `lib/api_key_check.js` → API Key 检测（两个函数：`checkApiKeyInDiff` 用于 git diff，`checkApiKeyInContent` 用于任意文本）
- `lib/bash_write_detector.js` → Bash 写命令识别（`extractWriteTargets` + `isSourceTarget`）

## Goals / Non-Goals

**Goals:**
- 堵住 NotebookEdit、Write/Edit 内容检查、Bash 写模式的安全盲区
- 扩展密钥前缀覆盖到主流云服务
- 保持零第三方依赖、fail-open 原则、现有 API 不变
- 每个修复都有对应测试

**Non-Goals:**
- 不重构 pre_tool_use.js 的单一职责问题（P1 #5，留给 Phase 3）
- 不做 DX 优化（拦截提示、调试模式等属于 Phase 2）
- 不追求 Bash 写检测的完美覆盖（子 shell 内嵌套任意深度不可能完全检测）
- 不改变 fail-open 语义（检测失败时放行，不阻断）

## Decisions

### D1: NotebookEdit 复用 pre_tool_use.js

在 hooks.json 添加一个 NotebookEdit matcher entry，指向同一个 pre_tool_use.js。

**替代方案:** 写一个独立的 notebook_pre_tool_use.js。
**选择理由:** NotebookEdit 的 tool_input 结构包含 `file_path` 字段，与 Write 类似。pre_tool_use.js 的 `isWriteOperation()` 只需在 `["Edit", "Write", "MultiEdit"]` 列表中加上 `"NotebookEdit"` 即可。无需独立脚本。

### D2: Write/Edit/MultiEdit/NotebookEdit 内容检查的插入点

在 pre_tool_use.js 的 API Key 检查段（当前仅针对 Bash git 命令），增加一个分支：当工具为 Write/Edit/MultiEdit/NotebookEdit 时，从 tool_input 中提取内容字段，调用 `checkApiKeyInContent`。

**内容字段映射:**
| 工具 | 内容字段 |
|------|----------|
| Write | `tool_input.content` |
| Edit | `tool_input.new_string` |
| MultiEdit | `tool_input.edits[].new_string`（多个拼接） |
| NotebookEdit | `tool_input.new_source` |

**替代方案:** 在每个工具的 matcher 下用不同的 hook 脚本。
**选择理由:** 集中在 pre_tool_use.js 一处处理，逻辑统一。内容字段提取是纯数据映射，几行代码。

### D3: Bash 写检测扩展策略 — 两层

**第一层：目标提取扩展**（在 `extractWriteTargets` 中添加新模式）

| 命令 | 提取规则 |
|------|----------|
| `dd of=file` | 提取 `of=` 后的路径 |
| `curl -o file` / `curl --output file` | 提取 `-o`/`--output` 后的参数 |
| `wget -O file` / `wget --output-document file` | 提取 `-O`/`--output-document` 后的参数 |
| `rsync src dest` | 提取最后一个参数（类似 cp） |
| `install src dest` | 提取最后一个参数 |
| `patch` | 检测 `-o` 参数或不带参数时视为就地修改 |
| `tar x` | 提取 `-C` 指定的目录或当前目录 |

**第二层：子 shell 保守标记**（在 `isBashWriteCommand` 中添加）

对 `bash -c`, `sh -c`, `eval`, `python -c`, `python3 -c`, `node -e`, `ruby -e`, `perl -e` ... 如果参数字符串中包含写操作关键词（`>`, `write`, `open(`, `fs.`），直接返回 `true`。

**替代方案:** 递归解析子 shell 内容。
**选择理由:** 子 shell 参数是字符串，完美解析等于实现一个 shell parser。保守标记（检测到子 shell + 写关键词就拦截）误报可控，漏报远小于当前的完全不检测。

### D4: 密钥前缀扩展列表

在 `KNOWN_PREFIX_PATTERN` 正则中追加：

| 前缀 | 服务 | 格式 |
|------|------|------|
| `sk_live_` | Stripe Secret Key | `sk_live_[A-Za-z0-9]{24,}` |
| `rk_live_` | Stripe Restricted Key | `rk_live_[A-Za-z0-9]{24,}` |
| `pk_live_` | Stripe Publishable Key | `pk_live_[A-Za-z0-9]{24,}` |
| `xoxb-` | Slack Bot Token | `xoxb-[A-Za-z0-9\-]{24,}` |
| `xoxp-` | Slack User Token | `xoxp-[A-Za-z0-9\-]{24,}` |
| `AIza` | Google API Key | `AIza[A-Za-z0-9_\-]{35}` |
| `npm_` | npm Token | `npm_[A-Za-z0-9]{36,}` |

**不加的：** Azure 密钥格式太通用（base64 字符串），误报率高。Anthropic 的 `sk-ant-` 已被 `sk-` 前缀覆盖。

## Risks / Trade-offs

- **子 shell 误报** → 用户在 bash -c 中执行无害的 echo + 重定向到 /tmp 会被拦截。缓解：只在参数含写关键词时才触发，且 OPENSPEC_SKIP 始终可用
- **正则复杂度** → KNOWN_PREFIX_PATTERN 变长，可读性下降。缓解：改为数组 + `new RegExp` 拼接，每个前缀一行
- **NotebookEdit tool_input 结构假设** → 依赖 `new_source` 字段名。如果 Claude Code 更新 API 则失效。缓解：字段不存在时跳过检查（fail-open）
- **密钥格式演化** → 服务商可能改变 token 格式。缓解：正则以最小前缀匹配，不过度限定长度
