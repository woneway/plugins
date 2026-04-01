# 通用开发规范

## 语言
始终用**中文**回复，包括解释、问题、总结。代码、变量名、技术标识符保持英文。

## 统一变更工作流（hook 强制执行）

所有代码变更必须通过 OpenSpec 工作流。Hook 会自动拦截未经 OpenSpec 授权的代码写入。

根据变更大小选择路径：

### 快速路径（bug 修复、小改动）

```
/opsx:new <name> → /opsx:ff → /opsx:apply → /opsx:archive
```

### 完整路径（新功能、架构变更）

```
1. /office-hours          — 理解问题，产出 design doc
2. /opsx:new <name>       — 创建变更，将 design doc 结论浓缩为 proposal.md
3. /opsx:ff               — 基于 proposal 生成 specs → design → tasks（充分探索代码再设计）
4. /plan-eng-review       — 可选，审查规划 artifacts
5. /opsx:apply            — 逐条实施 tasks
   └ 推荐: tdd-guide agent 先写测试
6. /opsx:verify           — 规格符合性检查（完整性+正确性+一致性）
7. security-reviewer 审查  — 代码级安全（注入/XSS/加密等）
8. /qa 或 /qa-only        — 集成/E2E 验证
9. /opsx:archive → /ship  — 归档变更 + 创建 PR
```

### 三层分工

| 层 | 工具 | 职责 |
|----|------|------|
| 产品层 | /office-hours, /plan-eng-review, /autoplan, /ship, /retro | 做不做？怎么交付？ |
| 变更管理层 | /opsx:new, /opsx:ff, /opsx:apply, /opsx:archive | 变更结构、状态、生命周期 |
| 工程质量层 | tdd-guide, security-reviewer, /review, /cso, /qa | 代码怎么写好？ |
| 设计层 | /design-consultation, /design-review, /design-shotgun | UI/UX 设计与审查 |

### 各阶段推荐 agents

| OpenSpec 阶段 | 推荐 Agent | 用途 |
|--------------|-----------|------|
| /opsx:apply | tdd-guide | 每个 task 先写测试再实现 |
| /opsx:verify | security-reviewer | 代码级安全漏洞检查 |

### 验证与审查分工

| 工具 | 检查维度 | 使用时机 |
|------|----------|----------|
| `/opsx:verify` | **规格符合性** | apply 完成后，检查 tasks 完成度、specs 覆盖度、design 一致性 |
| security-reviewer (agent) | **代码级安全** | verify 之后，审查注入、XSS、不安全加密等 |
| `/review` | **代码质量** | ship 前，审查 PR diff 的结构问题（SQL 安全、副作用等） |
| `/cso` | **基础设施安全** | 发布前或定期审计，覆盖 secrets、供应链、CI/CD、OWASP、STRIDE |
| `/qa` | **集成验证** | ship 前，E2E 功能验证 |

### 其他可用命令

| 命令 | 说明 |
|------|------|
| `/investigate` | 系统性根因分析（调试） |
| `/design-consultation` | UI/UX 设计系统建立 |
| `/design-review` | 视觉审查 + 迭代修复 |
| `/design-shotgun` | 多设计方案探索对比 |
| `/qa` | QA 测试 + 自动修复 |
| `/qa-only` | QA 测试（仅报告） |
| `/freeze` | 锁定编辑目录，防止改错文件 |
| `/retro` | 周度 commit 复盘 |

**紧急豁免：** `OPENSPEC_SKIP=1` 启动 claude，使用会被记录。

> 首次使用：`node ${CLAUDE_PLUGIN_ROOT}/scripts/setup.js`

## 概念澄清（先理解再行动）

遇到不确定的概念、术语、工具行为时，**禁止猜测**，必须按优先级依次确认：

1. **Explore agent 搜索代码** — 概念可能在代码/配置/注释中有定义
2. **OpenSpec 文档** — 检查 `openspec/` 目录下的 specs、proposal、design
3. **Memory** — 检查是否有历史会话记录过相关信息
4. **WebSearch** — 搜索官方文档、npm 包、GitHub 仓库
5. **询问用户** — 以上都无法确认时，明确说出「我不确定 X 是什么」并请用户澄清

**绝不**在未确认的情况下做出假设性判断或基于猜测执行操作。

## 任务追踪
- `/opsx:apply` 阶段以 `tasks.md` 为唯一任务源，不要用内置 TaskCreate/TaskUpdate 重复追踪同一任务。
- 内置 Task 工具仅用于 OpenSpec 之外的临时工作（如调试、探索）。

## 代码修改规范
- **优先使用 Edit / Write 工具**修改文件，不要用 Bash 重定向（`>`, `>>`）、`sed -i`、`tee` 等方式写文件。Hook 对 Bash 写操作的检测覆盖有限，Edit/Write 工具有完整的门禁保护。

## 安全
- **禁止**在代码中硬编码 API Key / Token / Secret（有 hook 保护）
- 敏感值统一从环境变量读取
