## 1. NotebookEdit 门禁覆盖

- [x] 1.1 hooks.json 添加 NotebookEdit PreToolUse matcher entry（指向 pre_tool_use.js）
- [x] 1.2 pre_tool_use.js `isWriteOperation()` 的工具列表中添加 `"NotebookEdit"`
- [x] 1.3 pre_tool_use.js OpenSpec 路径白名单段添加 NotebookEdit 的 file_path 检查
- [x] 1.4 测试：NotebookEdit 被 OpenSpec 门禁拦截、openspec/ 路径放行、被识别为写操作

## 2. Write/Edit/MultiEdit/NotebookEdit 内容 API Key 检查

- [x] 2.1 pre_tool_use.js import `checkApiKeyInContent`（当前只 import 了 `checkApiKeyInDiff`）
- [x] 2.2 在 API Key 检查段添加 Write/Edit/MultiEdit/NotebookEdit 分支，按 design D2 的字段映射提取内容
- [x] 2.3 确保内容检查在 OpenSpec 门禁之前执行（API Key 优先于工作流状态）
- [x] 2.4 测试：Write 含密钥被拦截、Edit new_string 含密钥被拦截、MultiEdit edits 含密钥被拦截、NotebookEdit new_source 含密钥被拦截
- [x] 2.5 测试：注释行和 .example 文件引用不误报、ready_to_apply 状态下仍拦截密钥

## 3. API Key 密钥前缀扩展

- [x] 3.1 api_key_check.js KNOWN_PREFIX_PATTERN 重构为数组 + RegExp 拼接（每个前缀一行，提升可读性）
- [x] 3.2 添加 Stripe 前缀：sk_live_、rk_live_（24+ 字符）（pk_live_ 按 eng review 移除，publishable key 非密钥）
- [x] 3.3 添加 Slack 前缀：xoxb-、xoxp-（24+ 字符含连字符）
- [x] 3.4 添加 Google API Key 前缀：AIza（35 字符）
- [x] 3.5 添加 npm token 前缀：npm_（36+ 字符）
- [x] 3.6 测试：每个新前缀的检测、sk_test_ 不误报、现有前缀（sk-/ghp_/gho_/AKIA）不受影响

## 4. Bash 写检测扩展 — 目标提取

- [x] 4.1 extractWriteTargets 添加 `dd of=<path>` 模式提取
- [x] 4.2 extractWriteTargets 添加 `curl -o/--output <path>` 模式提取
- [x] 4.3 extractWriteTargets 添加 `wget -O/--output-document <path>` 模式提取
- [x] 4.4 extractWriteTargets 添加 `rsync` 最后参数提取（类似 cp）
- [x] 4.5 extractWriteTargets 添加 `install` 最后参数提取（排除 npm/pip/brew 等包管理器前缀）
- [x] 4.6 测试：每个新模式的目标提取、/tmp 路径排除

## 5. Bash 写检测扩展 — 特殊命令和子 shell

- [x] 5.1 isBashWriteCommand 添加 `patch` 检测（直接返回 true）
- [x] 5.2 isBashWriteCommand 添加 `tar x/tar -x/tar --extract` 检测（提取模式返回 true，创建模式忽略）
- [x] 5.3 isBashWriteCommand 添加子 shell 检测：bash -c、sh -c、eval + 写关键词（>、write、open(、fs.）
- [x] 5.4 isBashWriteCommand 添加脚本解释器检测：python -c、python3 -c、node -e、ruby -e、perl -e + 写关键词
- [x] 5.5 测试：patch 检测、tar 提取 vs 创建、子 shell 有/无写关键词、脚本解释器有/无写关键词
- [x] 5.6 测试：bash -c "echo hello"（无写关键词）不误报 + 已知误报场景文档化

## 6. 集成验证

- [x] 6.1 运行完整测试套件，确认所有现有测试通过（无回归）— 121/121 通过
- [x] 6.2 手动验证：NotebookEdit 工具被 hooks 拦截（测试覆盖）
- [x] 6.3 手动验证：Write 工具写入含 Stripe key 的文件被拦截（实际触发：编辑测试文件时被自己的 hook 拦截）
- [x] 6.4 手动验证：Bash `curl -o src/x.js url` 被识别为写操作（测试覆盖）
