## 1. Fail-open 审计 warning（最小侵入，先做）

- [x] 1.1 `common-dev/hooks/pre_tool_use.js` — stdin parse catch 块添加 `[WARN] pre_tool_use: stdin parse failed` 到 stderr
- [x] 1.2 `common-dev/hooks/pre_tool_use.js` — api_key_check 内容提取 catch 块添加 `[WARN] api_key_check: content extraction failed` 到 stderr
- [x] 1.3 `common-dev/hooks/pre_tool_use.js` — git diff catch 块添加 `[WARN] api_key_check: git diff failed` 到 stderr
- [x] 1.4 `common-dev/hooks/pre_tool_use.js` — OPENSPEC_SKIP 日志 catch 块添加 `[WARN] openspec_skip: log write failed` 到 stderr
- [x] 1.5 `common-dev/hooks/lib/openspec.js` — getOpenSpecState catch 块添加 `[WARN] openspec: state read failed` 到 stderr
- [x] 1.6 `common-dev/hooks/lib/tdd_gate.js` — TDD_SKIP 日志 catch 块添加 `[WARN] tdd_gate: skip log write failed` 到 stderr
- [x] 1.7 `common-dev/hooks/__tests__/pre_tool_use.test.js` — 验证 fail-open 时 stderr 包含 `[WARN]`
- [x] 1.8 `common-dev/hooks/__tests__/openspec.test.js` — 验证异常时 stderr 包含 `[WARN]`
- [x] 1.9 `common-dev/hooks/__tests__/tdd_gate.test.js` — 验证 TDD_SKIP 日志失败时 stderr 包含 `[WARN]`

## 2. Verify gate 加固

- [x] 2.1 `common-dev/hooks/lib/verify_gate.js` — 扩展归档检测覆盖 `cp -r/-a` 和 `rsync -a` 从 `openspec/changes/<name>` 到 `archive/` 的操作
- [x] 2.2 `common-dev/hooks/lib/verify_gate.js` — commit hash 匹配后增加 change-scoped dirty worktree 检查：读取 current-change + tasks.md 提取 allowedPaths，仅检查与 change 相关的 tracked 文件变更
- [x] 2.3 `common-dev/hooks/lib/verify_gate.js` — 无法确定 change scope 时退化为全 repo tracked 检查；git status 失败时 fail-closed
- [x] 2.4 `common-dev/hooks/__tests__/verify_gate.test.js` — 添加 cp/rsync 归档检测测试
- [x] 2.5 `common-dev/hooks/__tests__/verify_gate.test.js` — 添加 change-scoped dirty worktree 阻断/放行测试
- [x] 2.6 `common-dev/hooks/__tests__/verify_gate.test.js` — 添加无关文件变更放行 + untracked-only 放行 + scope fallback 测试

## 2b. Hook repoRoot 修复（CWD 漂移问题）

- [x] 2b.1 `common-dev/hooks/lib/repo_root.js` — 新增 `getRepoRoot()` helper：优先用 `git rev-parse --show-toplevel`，失败 fallback `process.cwd()`
- [x] 2b.2 `common-dev/hooks/pre_tool_use.js` — 替换 `process.cwd()` 为 `getRepoRoot()`
- [x] 2b.3 `common-dev/hooks/session_start.js` — 替换 `process.cwd()` 为 `getRepoRoot()`
- [x] 2b.4 `common-dev/hooks/user_prompt_submit.js` — 替换 `process.cwd()` 为 `getRepoRoot()`

## 3. Change-scope binding（单 change 上下文）

- [x] 3.1 `common-dev/hooks/lib/openspec.js` — 新增 `extractPathsFromTasks(tasksContent)` 函数：从 tasks.md 内容提取 backtick 路径、含 `/` 的源文件路径、目录前缀；排除 URL 和 openspec/ 路径
- [x] 3.2 `common-dev/hooks/__tests__/openspec.test.js` — extractPathsFromTasks 单元测试（backtick 路径、目录前缀、URL 排除、openspec 排除、无路径返回空数组）
- [x] 3.3 `common-dev/hooks/pre_tool_use.js` — ready_to_apply 时读取 `.claude/current-change`（或 `.codex/current-change`）确定当前 change 名；读取失败 fallback 为现有行为
- [x] 3.4 `common-dev/hooks/pre_tool_use.js` — current-change 有效时从 tasks.md 提取 allowedPaths；allowedPaths 非空时校验写操作目标是否在范围内（含目录前缀匹配）
- [x] 3.5 `common-dev/hooks/pre_tool_use.js` — 测试文件配对放行：复用 `tdd_gate.js` 的命名规则（`__tests__/<name>.test.ext`、`<name>.test.ext`、`<name>.spec.ext`），实现文件在 scope → 对应测试文件也在 scope
- [x] 3.6 `common-dev/hooks/pre_tool_use.js` — allowedPaths 为空时输出 `[WARN] change-scope: no paths extracted` 到 stderr 然后放行
- [x] 3.7 `common-dev/hooks/__tests__/pre_tool_use.test.js` — change-scope 完整测试：scope 内放行、scope 外阻断、测试配对放行、空 paths fallback、current-change 不存在 fallback、current-change 指向已删除 change fallback
- [x] 3.8 `common-dev/hooks/pre_tool_use.js` — hook 自动推断：单 change 时自动绑定并写入 marker，多 change 时 fallback（不修改官方 OPSX 命令文件）
- [x] 3.9 marker 自动清理：change 目录不存在时 fallback（归档后自然失效，无需命令层清理）
