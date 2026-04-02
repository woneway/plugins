## 1. Git 命令豁免

- [x] 1.1 在 `isBashWriteCommand` 开头添加 git 命令检测：纯 git 命令直接返回 false
- [x] 1.2 确保 `git add/commit/push/pull/fetch/merge/checkout/branch/stash/rebase/tag/remote/show/blame/status/log/diff/rev-parse/rev-list/symbolic-ref` 均豁免
- [x] 1.3 确保 git 命令链接非 git 写命令时（`git add file && echo x > src/file.js`）仍被检测

## 2. Install 正则收紧

- [x] 2.1 修改 install 正则，要求 install 出现在命令起始位置或管道/分号/`&&` 之后
- [x] 2.2 验证 `install -m 755 build/app src/app` 仍被检测（待测试验证）
- [x] 2.3 验证 `git add simplified-installer/spec.md` 不再匹配 install 正则（待测试验证）

## 3. 测试验证

- [x] 3.1 运行现有测试确保不破坏已有行为
- [x] 3.2 验证 `git add openspec/specs/simplified-installer/spec.md` 不被判为写操作
- [x] 3.3 验证 `git commit -m "$(cat <<'EOF' ... EOF)"` 包含 `>` 字符不被判为写操作
- [x] 3.4 验证 `echo data > src/file.js` 仍被正确判为写操作
