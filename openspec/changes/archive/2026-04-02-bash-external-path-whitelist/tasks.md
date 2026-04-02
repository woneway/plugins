## 1. bash_write_detector.js 改进

- [x] 1.1 修改 `isBashWriteCommand` 中 eval/bash -c/sh -c 检测逻辑：检测到写指示符后先 `extractWriteTargets` 提取目标，有目标走 `isSourceTarget` 过滤，无目标保守返回 true
- [x] 1.2 修改 `isBashWriteCommand` 中脚本解释器（python/node/ruby/perl）检测逻辑：同上逻辑
- [x] 1.3 为新逻辑添加单元测试：eval 写外部路径不触发、eval 写源文件触发、eval 无法解析保守触发

## 2. pre_tool_use.js Bash 外部路径放行

- [x] 2.1 在步骤 2b 新增 Bash 工具的 repo 外路径检查：调用 `extractWriteTargets`，所有目标都在 repo 外时 exit(0)
- [x] 2.2 为新逻辑添加单元测试：Bash 写 ~/.gstack/ 放行、Bash 混合内外路径不放行、Bash 无目标不放行
