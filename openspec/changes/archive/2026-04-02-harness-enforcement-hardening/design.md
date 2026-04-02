## Context

当前 OpenSpec 门禁（`pre_tool_use.js`）在 `ready_to_apply` 状态下对所有写操作放行，不校验目标文件是否与具体 change/task 关联。`verify_gate.js` 仅匹配单一 `mv` 模式。多个 hook 的 `catch {}` 块静默放行无任何输出。

现有代码路径：
```
pre_tool_use.js
  → getOpenSpecState()          // 返回 state + change 名列表
  → state === "ready_to_apply"  // 直接 exit(0)，无范围校验
  → checkTddGate()              // 已有，但也不校验 change 归属

verify_gate.js
  → ARCHIVE_PATTERN             // 仅匹配 mv ... openspec/changes/archive/
  → getCurrentCommit()          // 只比对 HEAD hash，不检查 dirty
```

## Goals / Non-Goals

**Goals:**
- 单 change 上下文：通过 `.claude/current-change` 标记文件建立"当前正在实施的 change"，写操作范围绑定到该 change 的 tasks.md 文件列表
- Verify gate 加固：覆盖替代归档路径 + change-scoped dirty worktree 检查
- Fail-open 审计：所有静默 catch 块输出 stderr warning

**Non-Goals:**
- 不做 task 级绑定（粒度到 change 级即可）
- 不改变 fail-open 策略本身（仍然放行，但留痕）
- 不扩展 Bash 写检测覆盖面（rm/mkdir 等破坏性操作是另一个 change 的范围）
- 不加 PostToolUse hook（属于 P3/P4 范围）
- 不检测脚本化归档操作（不可穷举，只覆盖常见 cp/rsync 变体）

## Decisions

### D1: 单 change 上下文通过 `.claude/current-change` 标记文件实现

**方案**：`/opsx:apply <name>` 执行时写入 `.claude/current-change` 文件（内容为 change 名称）。`pre_tool_use.js` 读取该文件确定当前 change，从该 change 的 tasks.md 提取文件路径作为 `allowedPaths`。

**为什么用文件而非环境变量**：环境变量在子进程间不稳定传递；文件是 hook 最可靠的跨调用状态通道。

**生命周期**：`/opsx:apply` 开始时创建，`/opsx:archive` 或 `/opsx:apply <other>` 时覆写/删除。hook 读取失败时 fallback 为现有行为（全 change 并集判定 ready_to_apply）。

**为什么不要求 current-change 必须存在**：向后兼容——老 session 没有这个文件，不能阻断已有工作流。

### D2: tasks.md 文件路径提取 + fallback

**方案**：从 tasks.md 的 task 描述中提取文件路径模式（backtick 路径、含 `/` 的源文件路径、目录前缀）。提取不到路径时输出 `[WARN] change-scope: no paths extracted from tasks.md` 到 stderr，然后 fallback 全放行。

**为什么 fallback 为放行但加 warning**：强制所有 tasks.md 写路径不现实；但 warning 让用户知道 scope binding 没生效，可以改进 tasks.md。

### D3: 测试文件配对复用 `tdd_gate.js` 的 `hasTestFile()` 逻辑

**方案**：scope 检查时，如果目标是实现文件的对应测试文件（使用 `tdd_gate.js` 已有的三种命名规则：`__tests__/<name>.test.ext`、`<name>.test.ext`、`<name>.spec.ext`），自动放行。反之，如果实现文件在 scope 内，其对应测试文件也在 scope 内。

**为什么复用而非重写**：避免两套门禁的路径映射规则漂移（Codex review 指出的 #4 问题）。

### D4: Verify gate 归档检测扩展

**方案**：除现有 `mv` 模式外，增加 `cp -r/-a` 和 `rsync -a` 从 `openspec/changes/<name>` 到 `archive/` 的检测。

**为什么不检测脚本化归档**：不可穷举，覆盖最常见变体即可。design 明确承认这个边界。

### D5: Dirty worktree 检查限定到 change 相关文件

**方案**：verify gate 在 commit hash 匹配后，检查 `git status --porcelain` 中是否有与当前 change 的 `allowedPaths` 重叠的 tracked 文件变更。无关文件的修改不触发阻断。

**为什么不检查全 repo**：用户可能同时准备下一个 change 的文件，全 repo 检查会常态误拦（Codex review 指出的 #3 问题）。

**Fallback**：如果无法确定 change 的 allowedPaths（current-change 文件不存在或 tasks.md 无路径），退化为检查全 repo tracked 文件（保守行为）。

### D6: Fail-open warning 写入 stderr

**方案**：所有 `catch {}` 块改为 `catch (e) { process.stderr.write("[WARN] ..."); }`。不影响 exit code（仍然 exit(0) 放行）。

## Risks / Trade-offs

- **Current-change 文件过期**：用户可能忘记切换或文件残留。缓解：hook 读取时校验 change 目录是否仍存在。
- **tasks.md 路径提取准确率**：正则提取不可能 100% 准确。缓解：fallback + warning 让用户知道。
- **替代归档路径检测不可能穷举**：`cp && rm` 只是一种变体。缓解：覆盖最常见路径，完美防护需要架构变更（如封装 archive 为 API）。
- **Dirty worktree change-scoped 检查可能漏报**：用户修改了 change 相关文件但 allowedPaths 没覆盖到。缓解：提取失败时退化为全 repo 检查。
