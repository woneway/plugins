## ADDED Requirements

### Requirement: 只支持 install 和 uninstall action

CLI SHALL 只接受 install 和 uninstall 两个 action。其他 action（refresh-source、update）SHALL 报错。

#### Scenario: install action

- **WHEN** 用户执行 `plugins install common-dev --cli claude --env user`
- **THEN** 安装器 SHALL 读取 common-dev/plugin.json 并将声明的 capabilities 复制到 ~/.claude/

#### Scenario: uninstall action

- **WHEN** 用户执行 `plugins uninstall common-dev --cli claude --env user`
- **THEN** 安装器 SHALL 根据安装状态记录移除已安装的文件

#### Scenario: 无效 action

- **WHEN** 用户执行 `plugins refresh-source common-dev`
- **THEN** CLI SHALL 抛出错误提示 action 无效

### Requirement: CLI 参数默认值

--cli 参数 SHALL 默认为 `claude`，--env 参数 SHALL 默认为 `user`。

#### Scenario: 省略 --cli 和 --env

- **WHEN** 用户执行 `plugins install common-dev`
- **THEN** 安装器 SHALL 以 cli=claude、env=user 执行安装

#### Scenario: 显式指定参数

- **WHEN** 用户执行 `plugins install common-dev --cli codex --env project`
- **THEN** 安装器 SHALL 以 cli=codex、env=project 执行安装

### Requirement: 统一 copy 安装模式

安装器 SHALL 只使用文件复制模式安装内容。不 SHALL 支持 symlink、merge-copy、merge-symlink、ensure-dir 模式。

#### Scenario: 安装目录类型的 capability

- **WHEN** capabilities 声明 `"skills": "skills/"` 且 skills/ 下有多个子目录
- **THEN** 安装器 SHALL 将每个子目录递归复制到目标位置

#### Scenario: 安装文件类型的 capability

- **WHEN** capabilities 声明 `"agents": "agents/"` 且 agents/ 下有 .md 文件
- **THEN** 安装器 SHALL 将每个文件复制到目标位置

### Requirement: 安装目标路径

安装器 SHALL 将每个 capability 的内容复制到对应的目标路径：
- skills/ 下的子项 → `<target-root>/skills/<子项名>/`
- agents/ 下的子项 → `<target-root>/agents/<子项名>`
- rules/ 下的子项 → `<target-root>/rules/<子项名>`
- commands/ 下的子项 → `<target-root>/commands/<子项名>/`

target-root 为 ~/.claude（user 模式）或 .claude（project 模式），由 adapter 决定。

#### Scenario: user 模式安装 skills

- **WHEN** 以 env=user、cli=claude 安装，capabilities 声明 `"skills": "skills/"`
- **THEN** skills/ 下的每个子目录 SHALL 被复制到 ~/.claude/skills/<子目录名>/

#### Scenario: project 模式安装 rules

- **WHEN** 以 env=project 安装，capabilities 声明 `"rules": "rules/"`
- **THEN** rules/ 下的每个文件 SHALL 被复制到 .claude/rules/<文件名>

### Requirement: 安装状态追踪

安装器 SHALL 在安装时记录所有复制的文件路径及其 SHA256 哈希值。状态文件存储在 `~/.plugins/state/<plugin-name>/<cli>.json`（user 模式）或 `.plugins/state/<plugin-name>/<cli>.json`（project 模式）。

#### Scenario: 安装后状态记录

- **WHEN** 安装成功完成
- **THEN** 状态文件 SHALL 包含 pluginName、cli、env、version（可为 null）、installedAt、managedPaths 字段

### Requirement: 安全卸载

卸载时，安装器 SHALL 检查每个受管文件的 SHA256 哈希值。如果文件已被用户修改（哈希不匹配），SHALL 跳过该文件不删除。

#### Scenario: 未修改文件的卸载

- **WHEN** 卸载时受管文件的哈希值与安装时一致
- **THEN** 安装器 SHALL 删除该文件

#### Scenario: 用户修改过的文件不被卸载

- **WHEN** 卸载时受管文件的哈希值与安装时不一致（用户修改过）
- **THEN** 安装器 SHALL 跳过该文件，不删除

#### Scenario: 部分卸载后状态保留

- **WHEN** 卸载时有文件因哈希不匹配被跳过
- **THEN** 安装器 SHALL 保留 state 文件，仅移除已成功删除的路径条目，保留被跳过的路径条目

### Requirement: dry-run 模式

安装器 SHALL 支持 --dry-run 参数。dry-run 模式下不 SHALL 写入任何文件或状态，只输出计划操作。

#### Scenario: dry-run install

- **WHEN** 用户执行 `plugins install common-dev --dry-run`
- **THEN** 安装器 SHALL 输出将要安装的路径列表，不实际创建文件，不写入状态

### Requirement: 插件解析

安装器 SHALL 通过相对路径解析插件：在工作空间根目录下查找 `./<plugin-name>/plugin.json`。

#### Scenario: 插件不存在

- **WHEN** 用户执行 `plugins install nonexistent`
- **THEN** 安装器 SHALL 抛出错误提示插件不存在

#### Scenario: 缺少 plugin.json

- **WHEN** 插件目录存在但没有 plugin.json
- **THEN** 安装器 SHALL 抛出错误提示缺少插件声明
