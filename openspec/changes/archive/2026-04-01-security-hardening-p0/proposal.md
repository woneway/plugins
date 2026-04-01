## Why

common-dev 插件的安全钩子有三个 P0 级别的覆盖盲区，允许绕过 API Key 检查和 OpenSpec 工作流门禁。问题经 5 人团队交叉审查确认（综合评分 7.1/10，安全覆盖面是最大短板）。修复成本低，风险收益比最好，应立即执行。

## What Changes

- **hooks.json 添加 NotebookEdit matcher** ... 当前 PreToolUse 只覆盖 Bash/Edit/Write/MultiEdit，NotebookEdit 的 .ipynb 写入完全绕过所有门禁
- **Write/Edit/MultiEdit 触发 API Key 内容检查** ... `checkApiKeyInContent` 已实现并导出（`api_key_check.js:48-57`），但 `pre_tool_use.js` 只 import 了 `checkApiKeyInDiff`，仅在 `git commit/add` 时检查。密钥可通过 Write/Edit 直接写入磁盘
- **扩展 Bash 写检测模式** ... `extractWriteTargets()` 只覆盖重定向/cp/mv/tee/touch/sed-i，缺少 dd/curl-o/wget-O/rsync/install/patch/tar 以及子 shell 模式（bash -c/sh -c/eval/python -c/node -e）
- **扩展已知密钥前缀** ... 当前只覆盖 sk-/ghp_/gho_/AKIA，缺少 Stripe (rk_live_/sk_live_)、Slack (xoxb-/xoxp-)、Google (AIza)、Azure、npm token 等常见格式

## Capabilities

### New Capabilities

- `notebook-edit-gate`: hooks.json 添加 NotebookEdit 到 PreToolUse matchers，复用现有 pre_tool_use.js 逻辑
- `content-api-key-check`: Write/Edit/MultiEdit/NotebookEdit 工具写入时检查内容是否包含硬编码密钥
- `bash-write-detection-v2`: 扩展 Bash 写命令检测，覆盖 dd/curl/wget/rsync/install/patch/tar 和子 shell 模式
- `api-key-patterns-v2`: 扩展已知密钥前缀正则，覆盖主流云服务和 SaaS 平台的 token 格式

### Modified Capabilities

（无现有 specs 需要修改）

## Impact

- **文件:** `hooks/hooks.json`, `hooks/pre_tool_use.js`, `hooks/lib/bash_write_detector.js`, `hooks/lib/api_key_check.js`
- **测试:** 需要为每个新检测模式添加测试用例
- **兼容性:** 纯增量变更，不影响现有行为。新增检测可能产生少量误报（子 shell 模式采用保守策略），但 fail-open 原则保证不会阻断正常开发
- **依赖:** 无新依赖，保持零第三方依赖原则
