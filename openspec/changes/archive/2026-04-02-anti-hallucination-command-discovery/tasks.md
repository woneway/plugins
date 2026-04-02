## 1. Global Rule 文件

- [x] 1.1 创建 `common-dev/rules/verify-commands.md`，内容包含项目命令查找指导和外部命令验证指导
- [x] 1.2 确认 `common-dev/plugin.json` 的 capabilities 已包含 `"rules": "rules/"`（如不存在则添加）

## 2. Plugin Command Declaration

- [x] 2.1 在 `common-dev/plugin.json` 中添加 `commands_help` 顶层字段，声明 reinstall 和 uninstall 命令
- [x] 2.2 确认 commands_help 的每个条目包含 description（必填）和 usage（必填），when 为可选

## 3. Installer 命令文件生成

- [x] 3.1 修改 `lib/installer.js`：在 installForCli 流程中，检查 plugin.json 的 commands_help 字段
- [x] 3.2 如果 commands_help 存在，生成 `<plugin-name>-commands.md` markdown 内容
- [x] 3.3 将生成的文件写入 rules 目标目录（adapter.resolveTarget(envName, projectRoot, "rules/<plugin-name>-commands.md")）
- [x] 3.4 将生成文件的路径加入 managedPaths，确保卸载时自动清理

## 4. 测试验证

- [x] 4.1 运行现有测试确保不破坏已有行为
- [x] 4.2 安装 common-dev 并验证 `~/.claude/rules/verify-commands.md` 已部署
- [x] 4.3 安装 common-dev 并验证 `~/.claude/rules/common-dev-commands.md` 已生成且内容正确
- [x] 4.4 验证卸载后两个文件均被清理
- [x] 4.5 验证无 commands_help 的插件安装行为不变（向后兼容）
