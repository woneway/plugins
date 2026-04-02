## 1. WRITE_INDICATORS 拆分

- [x] 1.1 将 `WRITE_INDICATORS` 拆为 `REDIRECT_WRITE_INDICATOR`（`(?<![0-9])>{1,2}`）和 `CODE_WRITE_INDICATOR`（`\bwrite\w*\(|\bopen\s*\(|\bfs[.'"]|\bwriteFile`）两个常量
- [x] 1.2 更新 `isBashWriteCommand` 中 eval/bash-c 分支：用 `REDIRECT_WRITE_INDICATOR` 或 `CODE_WRITE_INDICATOR` 替换原 `WRITE_INDICATORS` 调用
- [x] 1.3 更新 `isBashWriteCommand` 中 python/node/ruby/perl 分支：同上替换

## 2. 保守回退逻辑修正

- [x] 2.1 在 eval/bash-c 分支中，当 `targets.length === 0` 时，仅在 `CODE_WRITE_INDICATOR` 匹配时保守返回 true；仅 `REDIRECT_WRITE_INDICATOR` 匹配时返回 false
- [x] 2.2 在 python/node/ruby/perl 分支中，应用同样的保守回退逻辑

## 3. extractWriteTargets fd 重定向规则修正

- [x] 3.1 修改重定向提取正则：移除 `(?<![0-9])` lookbehind，改为匹配所有 `>{1,2}\s*(\S+)` 重定向
- [x] 3.2 添加后处理过滤：排除目标为 `/dev/` 开头或 `&` 开头（fd-to-fd）的条目
- [x] 3.3 确保 `1>src/file.js`、`2>error.log` 等 fd-to-file 重定向被正确提取

## 4. 测试验证

- [x] 4.1 运行现有测试确保不破坏已有行为
- [x] 4.2 验证核心修复场景：`eval "$(cmd 2>/dev/null)"` 不再被判为写操作
- [x] 4.3 验证 `python3 -c` + `2>/dev/null` 管道命令不再被判为写操作
- [x] 4.4 验证 `1>src/file.js` 被正确检测为写操作
- [x] 4.5 验证保守回退仍对 `eval "$(cmd)" && fs.writeFileSync(...)` 生效
