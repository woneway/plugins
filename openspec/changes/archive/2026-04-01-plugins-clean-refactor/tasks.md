## 1. 简化 lib/cli.js

- [x] 1.1 删除 refresh-source 和 update action，只保留 install 和 uninstall
- [x] 1.2 删除 --source 参数解析和 VALID_SOURCES 常量
- [x] 1.3 --cli 默认为 claude，--env 默认为 user（均变为可选参数）

## 2. 简化 lib/installer.js

- [x] 2.1 删除 customInstaller 分支逻辑，loadPlugin 直接读 capabilities 对象
- [x] 2.2 重写 installForCli：遍历 capabilities 对象，对每个条目将源目录内容复制到目标位置
- [x] 2.3 删除 updatePlugin 和 refreshPluginSources 函数
- [x] 2.4 删除 getEntriesForTarget 和 ensurePluginSupportsCli 函数
- [x] 2.5 修复部分卸载：跳过文件时保留 state 中对应条目，仅移除已删除的条目

## 3. 简化 lib/install-ops.js

- [x] 3.1 删除 symlink、merge-copy、merge-symlink、ensure-dir 模式代码
- [x] 3.2 简化 installEntry 为只处理 copy 模式（目录递归复制、文件复制）
- [x] 3.3 简化 collectManagedPaths 为只处理 copy 模式
- [x] 3.4 在 removeManagedPaths 中保留 symlink 类型处理（兼容旧安装状态的卸载）

## 4. 清理 lib/fs-utils.js

- [x] 4.1 删除 symlinkManaged 函数（不再使用 symlink 模式）

## 5. 重写测试

- [x] 5.1 创建新的测试 fixture：用新 plugin.json 格式的简单测试插件
- [x] 5.2 重写 cli.test.js：覆盖 install/uninstall 参数解析、默认值、错误路径
- [x] 5.3 重写 installer.test.js：覆盖新格式 install/uninstall 循环、dry-run、用户修改文件保护（含 state 保留验证）、多 CLI 安装、插件不存在报错

## 6. 更新 plugin.json

- [x] 6.1 将 common-dev/plugin.json 改为新格式：capabilities 为对象映射，删除 customInstaller 和 supportedCli 字段

## 7. 重组 common-dev 目录结构

- [x] 7.1 将 common-dev/sources/gstack/skills/ 下所有 skill 目录复制到 common-dev/skills/
- [x] 7.2 将 common-dev/sources/openspec/skills/ 下所有 skill 目录复制到 common-dev/skills/
- [x] 7.3 将 common-dev/sources/openspec/commands/ 复制到 common-dev/commands/
- [x] 7.4 将 common-dev/sources/ecc/agents/ 下所有文件复制到 common-dev/agents/
- [x] 7.5 将 common-dev/sources/custom/rules/ 下所有文件复制到 common-dev/rules/
- [x] 7.6 删除 common-dev/sources/ 目录
- [x] 7.7 删除 common-dev/scripts/setup.js

## 8. 验证

- [x] 8.1 运行测试套件确认全部通过
- [x] 8.2 手动执行 install + uninstall 验证实际安装效果
