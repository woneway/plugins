## Context

升级后仓库遗留了与当前结构不一致的配置和文档。安装器（`lib/installer.js`）只读取 `common-dev/plugin.json` 的 `capabilities` 字段来决定分发什么资产。当前 `plugin.json` 仍声明 `"rules": "rules/"`，但 `rules/` 目录已清空删除。`README.md` 大量引用已删除的目录和旧安装流程。`.gitignore` 缺少 `.DS_Store`。

## Goals / Non-Goals

**Goals:**
- `plugin.json` 的 capabilities 声明与实际目录结构一致
- `README.md` 准确反映当前安装方式和插件结构
- `.gitignore` 防止 macOS 系统文件入库

**Non-Goals:**
- 不修改安装器逻辑（`lib/installer.js`）
- 不修改 hook 脚本
- 不删除 `SKILL.md.tmpl`（待确认仓库定位后再决定）

## Decisions

1. **直接编辑而非重建**：三个文件都是小改动，直接编辑即可，无需架构变更
2. **README 精简而非扩展**：移除过时内容，保留仍准确的部分（hook 架构、OpenSpec 四态门禁、开发命令等），不新增内容

## Risks / Trade-offs

- [风险] README 精简后可能遗漏仍有效的信息 → 仅删除已验证过时的段落，保留其余
- [风险] 移除 rules capability 后旧版安装器可能报错 → 安装器对缺失 capability 是 skip 逻辑，不会报错
