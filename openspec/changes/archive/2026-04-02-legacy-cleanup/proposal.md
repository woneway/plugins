## Why

升级后仓库中遗留了多个过时文件和配置：旧格式的 marketplace/plugin manifest（`.claude-plugin/`、`.codex-plugin/`）、空目录、构建产物、与实际能力不一致的 `plugin.json` 声明，以及严重过时的 `README.md`。这些遗留项误导开发者和安装器对插件结构的理解。

## What Changes

- 更新 `.gitignore`，添加 `.DS_Store` 排除规则
- 从 `common-dev/plugin.json` 移除已删除的 `rules` capability 声明
- 重写 `common-dev/README.md`，移除对已删除目录（`.claude-plugin/`、`.codex-plugin/`、`sources/`、`mcp`、`rules/common.md`）的引用，使文档与当前仓库结构一致

## Capabilities

### New Capabilities

无

### Modified Capabilities

- `plugin-manifest-v2`: `plugin.json` 的 capabilities 声明需移除 `rules`，与实际目录结构保持一致

## Impact

- `.gitignore` — 新增一行 `.DS_Store`
- `common-dev/plugin.json` — 移除 `"rules": "rules/"` 条目
- `common-dev/README.md` — 重写，反映当前实际结构（hooks、skills、agents、commands）
- 无 API 或依赖变更，无 breaking change
