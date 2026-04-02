---
name: openspec-verify-change
description: Verify implementation matches change artifacts. Use when the user wants to validate that implementation is complete, correct, and coherent before archiving.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.1"
  generatedBy: "1.1.1"
---

Verify that an implementation matches the change artifacts (specs, tasks, design).
**verify 结果由 hook 强制检查**：archive 的 `mv` 命令会被 `pre_tool_use.js` 的 verify gate 拦截，
未通过 verify 或未写入状态文件时，archive 操作将被系统层阻断，而非依赖 skill 文本提示。

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **If no change name provided, prompt for selection**

   Run `openspec list --json` to get available changes. Use the **AskUserQuestion tool** to let the user select.

   Show changes that have implementation tasks (tasks artifact exists).
   Include the schema used for each change if available.
   Mark changes with incomplete tasks as "(In Progress)".

   **IMPORTANT**: Do NOT guess or auto-select a change. Always let the user choose.

2. **Check status and load change directory**
   ```bash
   openspec instructions apply --change "<name>" --json
   ```
   Parse the JSON to get `changeDir` and `contextFiles`. Read all available artifacts.

3. **L1 检查（客观，失败 → 阻断，不写状态文件）**

   **L1-a: tasks.md checkbox 完整性**
   - 读取 tasks.md，统计 `- [ ]`（未完成）和 `- [x]`（完成）数量
   - 若存在未完成 checkbox → L1 FAIL，列出未完成 task

   **L1-b: 基于 merge-base 的 diff 非空**
   ```bash
   BASE=$(git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null || echo "")
   [ -n "$BASE" ] && git diff "$BASE" HEAD --stat 2>/dev/null || git diff HEAD~1 HEAD --stat 2>/dev/null
   ```
   - 若 diff 为空（无任何文件变更）→ L1 FAIL，提示"无实际代码变更"
   - 注意：使用 commit diff（非 working tree），避免 commit 后 diff 为空的误判

   **若任一 L1 检查失败：**
   - 输出 FAIL 报告，列出失败原因
   - **不写入** `.verify-state.json`
   - **停止**，不继续 L2/L3/L4

4. **L2 检查（客观，失败 → 阻断，不写状态文件）**

   按优先级查找验证命令：
   1. 读取 `openspec/config.yaml` 中的 `verify_command` 字段
   2. 读取 `package.json` 的 `scripts.test`（非空且非纯 `echo`/`exit 0`）
   3. 若均无 → 跳过 L2

   若找到验证命令，运行它：
   ```bash
   <verify_command>
   ```
   - exit code 0 → L2 通过
   - exit code 非 0 → L2 FAIL，显示命令输出，不写状态文件，停止

5. **L3/L4 检查（AI 判断，失败 → warn，写未确认状态文件）**

   读取 tasks.md 和 git diff（同 L1-b 的基准）。
   对每条 task 逐一核查 diff 中是否存在对应实现，输出 task-by-task 证据表：

   ```
   Task 1.1: <task description>
     → diff 中: common-dev/hooks/lib/verify_gate.js（新增）✓
   Task 1.2: <task description>
     → diff 中: 未找到对应实现 ⚠
   ```

   - 所有 task 均有对应 diff → L3/L4 通过
   - 任意 task 无对应 diff → L3/L4 产生 warn，列出具体缺失项

6. **写入 verify 状态文件**

   获取当前 git HEAD：
   ```bash
   git rev-parse --short HEAD
   ```

   **若 L1/L2 均通过、L3/L4 无 warn**：
   ```bash
   cat > openspec/changes/<name>/.verify-state.json << 'EOF'
   {"result":"pass","userConfirmed":true,"commit":"<HEAD>","timestamp":"<ISO8601>"}
   EOF
   ```

   **若 L1/L2 均通过、L3/L4 有 warn**：
   先写入未确认状态：
   ```bash
   cat > openspec/changes/<name>/.verify-state.json << 'EOF'
   {"result":"warn","userConfirmed":false,"commit":"<HEAD>","timestamp":"<ISO8601>"}
   EOF
   ```

   然后展示 warn 详情，使用 **AskUserQuestion** 询问用户：
   > verify 发现以上 warn。archive 前需要你明确确认。
   > A) 确认归档（warn 已知，接受风险）
   > B) 取消，我先修复这些问题

   若用户选 A，更新状态文件：
   ```bash
   cat > openspec/changes/<name>/.verify-state.json << 'EOF'
   {"result":"warn","userConfirmed":true,"commit":"<HEAD>","timestamp":"<ISO8601>"}
   EOF
   ```

   若用户选 B → 不更新，提示修复后重新运行 `/opsx:verify`。

7. **输出最终报告**

   **通过时：**
   ```
   ## Verify 通过：<change-name>

   L1 ✓ 所有 task 完成，代码有变更
   L2 ✓ 验证命令通过（或跳过）
   L3/L4 ✓ 所有 task 均有对应实现

   状态文件已写入：openspec/changes/<name>/.verify-state.json
   可以运行 /opsx:archive 归档。
   ```

   **warn 已确认时：**
   ```
   ## Verify 通过（含 warn）：<change-name>

   L1 ✓ / L2 ✓ / L3/L4 ⚠（用户已确认）

   [warn 详情]

   状态文件已写入（userConfirmed: true）。
   可以运行 /opsx:archive 归档。
   ```

   **失败时：**
   ```
   ## Verify 失败：<change-name>

   [失败原因和修复建议]

   未写入状态文件。修复后重新运行 /opsx:verify。
   ```

**注意**

- 状态文件基于 git commit hash，commit 后若有新变更需重新 verify
- verify gate 在 hook 层强制检查，skill 文本只是引导，实际阻断在系统层
- OPENSPEC_SKIP=1 可豁免 verify gate（同时豁免 OpenSpec 门禁）
