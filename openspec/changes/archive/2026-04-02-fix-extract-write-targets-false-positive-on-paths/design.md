## Context

`extractWriteTargets` 在原始命令字符串上跑正则，把 `>` 和 `install` 当作 shell 操作符/命令匹配。但命令字符串中可能包含 heredoc 文本、引号内容、文件路径，这些不是 shell 操作符。

## Goals / Non-Goals

**Goals:**

- `git add/commit/status/log/diff` 等 git 只读/元数据命令不被判为写操作
- heredoc 和引号内的 `>` 不被当作重定向
- 路径中包含 "install" 的文件名不被 install 正则匹配

**Non-Goals:**

- 不做完整的 shell 解析器（复杂度太高）
- 不改 `isBashWriteCommand` 的整体架构

## Decisions

### Decision 1: git 命令前置豁免

**选择：** 在 `isBashWriteCommand` 开头增加 git 命令检测。纯 git 命令（`git add`、`git commit`、`git status`、`git log`、`git diff`、`git push`、`git pull`、`git fetch`、`git merge`、`git checkout`、`git branch`、`git stash`、`git rebase`、`git tag`、`git remote`、`git show`、`git blame`、`git rev-parse`、`git rev-list`、`git symbolic-ref`）直接返回 false。

**为什么：** git 通过自己的对象存储管理文件，不通过 shell 重定向写源文件。即使 `git add` 修改了 index，也不属于 hook 需要拦截的"源文件写操作"。这是最简单、最可靠的修复方式，一行正则覆盖所有 git 误报。

**风险：** `git checkout -- file` 会覆盖文件内容，但这属于 git 操作而非代码生成，OpenSpec 门禁不应管控。

### Decision 2: install 正则收紧为独立命令

**选择：** 将 `\binstall\s+` 改为要求 install 出现在命令起始位置或管道/分号之后：`(?:^|[|;&]\s*)\binstall\s+`。这样路径中的 "installer" 或 "simplified-installer" 不会匹配。

**替代方案：** 要求 install 前面没有 `/`（排除路径）。但 `(?<!\/)` lookbehind 在某些情况下不够可靠。命令起始位置检测更语义化。

### Decision 3: 不做 heredoc 内容剥离（暂缓）

**选择：** 不在 v1 中实现 heredoc 内容剥离。git 豁免已经覆盖了 `git commit -m "$(cat <<'EOF'...)"` 的场景。如果后续出现非 git 命令中 heredoc 的误报，再加此功能。

**原因：** heredoc 解析复杂（`<<EOF`、`<<'EOF'`、`<<-EOF`、嵌套），实现成本高且目前只有 git commit 触发。YAGNI。

## Risks / Trade-offs

**[Risk] git 豁免可能太宽泛** → git 子命令白名单限制了范围，不是所有 git 命令都豁免。且 git 操作不属于 OpenSpec 管控范围。

**[Risk] install 正则收紧可能漏掉某些合法场景** → `install` 作为独立命令（非 npm/pip 等包管理器前缀）在实际使用中非常少见。即使漏掉，最终的 `isSourceTarget` 过滤仍然是兜底。
