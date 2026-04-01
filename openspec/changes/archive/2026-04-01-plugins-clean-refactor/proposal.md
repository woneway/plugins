## Why

plugins 项目当前结构混乱：sources/ 下四个来源目录（gstack/ecc/openspec/custom）边界不清，安装流程需要 refresh-source + install 两步加 marketplace 注册，自定义安装器（scripts/setup.js）和框架安装器（lib/installer.js）职责重叠。代码量小（lib/ ~670 行），现在重构成本最低。

## What Changes

- **BREAKING** plugin.json capabilities 格式从字符串数组改为对象映射（`{"skills": "skills/"}` 替代 `["skills"]`）
- 删除 sources/ 目录，将其内容平铺到 common-dev/ 下的标准目录（skills/、agents/、rules/、commands/）
- 删除 scripts/setup.js 自定义安装器，所有安装逻辑回归 lib/installer.js
- 删除 refresh-source 和 update action，安装器只支持 install / uninstall
- 删除 symlink、merge-copy、merge-symlink、ensure-dir 安装模式，统一使用 copy
- 保留 .claude-plugin/ 和 .codex-plugin/（hooks 由 Claude Code / Codex 原生插件系统管理）
- CLI 参数 --cli 和 --env 设置默认值（claude、user）

## Capabilities

### New Capabilities

- `plugin-manifest-v2`: 新的 plugin.json 协议，capabilities 为对象映射格式，安装器根据声明遍历目录并复制到目标位置
- `simplified-installer`: 简化后的安装器，只支持 install/uninstall，只支持 copy 模式，不依赖自定义安装器

### Modified Capabilities

（无。现有 specs 均为安全/hooks 相关，本次重构不改变 hooks 行为。）

## Impact

- **lib/cli.js**: 删除 refresh-source、update action，删除 --source 参数，--cli 默认 claude，--env 默认 user
- **lib/installer.js**: 删除 customInstaller 分支、refreshPluginSources、updatePlugin，简化 loadPlugin 读取新格式
- **lib/install-ops.js**: 删除 symlink/merge-copy/merge-symlink/ensure-dir 模式代码
- **common-dev/plugin.json**: 格式变更
- **common-dev/sources/**: 整个目录删除，内容迁移到 common-dev/skills/、agents/、rules/、commands/
- **common-dev/scripts/setup.js**: 删除
- **test/**: 测试需要重写以匹配新 API
