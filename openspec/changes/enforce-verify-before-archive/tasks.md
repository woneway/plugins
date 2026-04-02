## 1. 新增 lib/verify_gate.js（hook 层）

- [x] 1.1 检测 bash 命令是否匹配 archive mv 模式（正则：`mv openspec/changes/<name> openspec/changes/archive/`）
- [x] 1.2 读取 `openspec/changes/<name>/.verify-state.json`，处理文件不存在的情况
- [x] 1.3 检查 commit hash 是否匹配当前 HEAD，过期则阻断
- [x] 1.4 检查 result + userConfirmed，未确认 warn 则阻断
- [x] 1.5 支持 OPENSPEC_SKIP=1 豁免
- [x] 1.6 为 verify_gate.js 编写单元测试（覆盖：pass、warn-confirmed、warn-unconfirmed、expired、missing、skip）

## 2. 接入 pre_tool_use.js

- [x] 2.1 在 pre_tool_use.js 编排器中调用 verify_gate.js，与 openspec.js 同级

## 3. 更新 /opsx:verify skill

- [x] 3.1 添加 L1 检查：tasks.md 所有 checkbox 为 `[x]`（fail → 不写状态文件）
- [x] 3.2 添加 L1 检查：基于 merge-base 的 diff 非空（fail → 不写状态文件）
- [x] 3.3 添加 L2 检查：读 openspec/config.yaml 或 package.json 获取验证命令并运行
- [x] 3.4 添加 L3/L4 检查：AI 输出 task-by-task 证据表，产生 warn
- [x] 3.5 用户确认 warn 后写 `{result:"warn", userConfirmed:true, commit, timestamp}`
- [x] 3.6 全部通过后写 `{result:"pass", userConfirmed:true, commit, timestamp}`

## 4. 更新 /opsx:archive skill

- [x] 4.1 移除 skill 内的 verify 软约束描述，改为说明"verify 状态由 hook 强制检查"
- [x] 4.2 归档流程中告知用户"如未运行 verify，mv 命令将被 hook 阻断"
