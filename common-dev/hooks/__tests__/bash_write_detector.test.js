const {
  isBashWriteCommand,
  extractWriteTargets,
  hasNonOpenSpecWriteTarget,
} = require("../lib/bash_write_detector");

describe("isBashWriteCommand", () => {
  // --- 现有模式 ---
  test("echo > src/index.js → true", () => {
    expect(isBashWriteCommand("echo 'hello' > src/index.js")).toBe(true);
  });

  test("echo >> src/index.js → true", () => {
    expect(isBashWriteCommand("echo 'hello' >> src/index.js")).toBe(true);
  });

  test("sed -i 's/old/new/' src/file.js → true", () => {
    expect(isBashWriteCommand("sed -i 's/old/new/' src/file.js")).toBe(true);
  });

  test("sed --in-place → true", () => {
    expect(isBashWriteCommand("sed --in-place 's/old/new/' src/file.js")).toBe(true);
  });

  test("tee src/output.js → true", () => {
    expect(isBashWriteCommand("echo hello | tee src/output.js")).toBe(true);
  });

  test("cp src/a.js src/b.js → true", () => {
    expect(isBashWriteCommand("cp src/a.js src/b.js")).toBe(true);
  });

  test("mv src/old.js src/new.js → true", () => {
    expect(isBashWriteCommand("mv src/old.js src/new.js")).toBe(true);
  });

  test("touch src/new.js → true", () => {
    expect(isBashWriteCommand("touch src/new.js")).toBe(true);
  });

  test("ls -la → false", () => {
    expect(isBashWriteCommand("ls -la")).toBe(false);
  });

  test("echo > /tmp/test.txt → false（/tmp 排除）", () => {
    expect(isBashWriteCommand("echo hello > /tmp/test.txt")).toBe(false);
  });

  test("cat src/index.js → false", () => {
    expect(isBashWriteCommand("cat src/index.js")).toBe(false);
  });

  test("echo > image.png → false（非源文件）", () => {
    expect(isBashWriteCommand("echo hello > image.png")).toBe(false);
  });

  // --- 新增模式：dd ---
  test("dd of=src/data.bin → true", () => {
    expect(isBashWriteCommand("dd if=/dev/zero of=src/data.bin bs=1024 count=10")).toBe(true);
  });

  // --- 新增模式：curl ---
  test("curl -o src/config.json → true", () => {
    expect(isBashWriteCommand("curl -o src/config.json https://example.com")).toBe(true);
  });

  test("curl --output lib/data.yaml → true", () => {
    expect(isBashWriteCommand("curl --output lib/data.yaml https://example.com")).toBe(true);
  });

  test("curl -o /tmp/download.json → false（/tmp 排除）", () => {
    expect(isBashWriteCommand("curl -o /tmp/download.json https://example.com")).toBe(false);
  });

  // --- 新增模式：wget ---
  test("wget -O src/index.html → true", () => {
    expect(isBashWriteCommand("wget -O src/index.html https://example.com")).toBe(true);
  });

  // --- 新增模式：rsync ---
  test("rsync -av src/old.js src/new.js → true", () => {
    expect(isBashWriteCommand("rsync -av src/old.js src/new.js")).toBe(true);
  });

  // --- 新增模式：install（排除包管理器） ---
  test("install -m 755 build/app src/app → true", () => {
    expect(isBashWriteCommand("install -m 755 build/app src/app")).toBe(true);
  });

  test("npm install express → false（包管理器排除）", () => {
    expect(isBashWriteCommand("npm install express")).toBe(false);
  });

  test("pip install -e ./src/mypackage → false（包管理器排除）", () => {
    expect(isBashWriteCommand("pip install -e ./src/mypackage")).toBe(false);
  });

  test("brew install node → false（包管理器排除）", () => {
    expect(isBashWriteCommand("brew install node")).toBe(false);
  });

  // --- 新增模式：patch ---
  test("patch -p1 < fix.diff → true", () => {
    expect(isBashWriteCommand("patch -p1 < fix.diff")).toBe(true);
  });

  // --- 新增模式：tar ---
  test("tar xzf archive.tar.gz -C src/ → true", () => {
    expect(isBashWriteCommand("tar xzf archive.tar.gz -C src/")).toBe(true);
  });

  test("tar -xf archive.tar → true", () => {
    expect(isBashWriteCommand("tar -xf archive.tar")).toBe(true);
  });

  test("tar czf backup.tar.gz src/ → false（创建模式）", () => {
    expect(isBashWriteCommand("tar czf backup.tar.gz src/")).toBe(false);
  });

  // --- 新增模式：子 shell ---
  test("bash -c 'echo secret > src/config.js' → true", () => {
    expect(isBashWriteCommand("bash -c 'echo secret > src/config.js'")).toBe(true);
  });

  test("sh -c 'node -e \"fs.writeFileSync(...)\"' → true", () => {
    expect(isBashWriteCommand('sh -c "node -e fs.writeFileSync()"')).toBe(true);
  });

  test("eval 'echo > src/x.js' → true", () => {
    expect(isBashWriteCommand("eval 'echo > src/x.js'")).toBe(true);
  });

  test("bash -c 'echo hello' → false（无写关键词）", () => {
    expect(isBashWriteCommand("bash -c 'echo hello'")).toBe(false);
  });

  // --- eval/bash -c 写外部路径不触发 ---
  test("eval 'echo >> ~/.gstack/analytics/usage.jsonl' → false（外部路径非源文件）", () => {
    expect(isBashWriteCommand("eval \"echo data >> ~/.gstack/analytics/usage.jsonl\"")).toBe(false);
  });

  test("bash -c 'touch ~/.gstack/sessions/12345' → false（外部路径非源文件）", () => {
    expect(isBashWriteCommand("bash -c 'touch ~/.gstack/sessions/12345'")).toBe(false);
  });

  // --- eval 无法解析目标时保守触发 ---
  test("eval with write indicator but no extractable targets → true（保守行为）", () => {
    // eval 内部有写指示符，extractWriteTargets 无法提取任何目标 → 保守返回 true
    expect(isBashWriteCommand("eval \"$(complex_command)\" && writeFile")).toBe(true);
  });

  test("eval with redirect to non-source file → false（目标非源文件）", () => {
    // eval 有 > 重定向，但目标不匹配源文件模式
    expect(isBashWriteCommand("eval \"$(complex_command)\" > something")).toBe(false);
  });

  // --- 新增模式：脚本解释器 ---
  test("python -c \"open('src/hack.py','w').write('x')\" → true", () => {
    expect(isBashWriteCommand("python -c \"open('src/hack.py','w').write('x')\"")).toBe(true);
  });

  test("node -e \"require('fs').writeFileSync(...)\" → true", () => {
    expect(isBashWriteCommand("node -e \"require('fs').writeFileSync('src/x.js','y')\"")).toBe(true);
  });

  test("python -c 'print(hello)' → false（无写关键词）", () => {
    expect(isBashWriteCommand("python -c 'print(hello)'")).toBe(false);
  });

  // --- 脚本解释器内部写操作无法静态提取，保守判定 ---
  test("node -e writeFileSync 内部路径无法提取 → true（保守行为）", () => {
    // writeFileSync 的目标在 JS 字符串内部，extractWriteTargets 无法提取，保守返回 true
    expect(isBashWriteCommand("node -e \"require('fs').writeFileSync('/Users/x/.gstack/data.json','y')\"")).toBe(true);
  });

  // --- 脚本解释器 + 外层重定向到非源文件路径 ---
  test("node -e with redirect to external path → false", () => {
    expect(isBashWriteCommand("node -e \"console.log('hi')\" > ~/.gstack/output.log")).toBe(false);
  });

  // --- fd 重定向不误判 ---
  test("2>/dev/null 不被误判为写操作", () => {
    expect(isBashWriteCommand("some-command 2>/dev/null")).toBe(false);
  });

  test("gstack 更新检查命令不被误判", () => {
    expect(isBashWriteCommand(
      '_UPD=$(~/.claude/skills/gstack/bin/gstack-update-check 2>/dev/null || .claude/skills/gstack/bin/gstack-update-check 2>/dev/null || true); [ -n "$_UPD" ] && echo "$_UPD"'
    )).toBe(false);
  });

  // --- 已知误报场景（已知限制：正则不理解引号） ---
  test("已知限制：参数字符串中提到 sed -i 被误匹配", () => {
    // 正则不区分 "运行命令" 和 "在参数中提到命令"。
    // fail-open 原则下，误报只触发 OpenSpec 门禁，不阻断 ready_to_apply 状态的工作。
    expect(isBashWriteCommand("echo 'use sed -i for in-place editing'")).toBe(true);
  });
});

describe("extractWriteTargets", () => {
  test("echo > a.js >> b.js → 包含 a.js 和 b.js", () => {
    const targets = extractWriteTargets("echo hello > a.js >> b.js");
    expect(targets).toContain("a.js");
    expect(targets).toContain("b.js");
  });

  test("cp x.js y.js → 包含 y.js", () => {
    const targets = extractWriteTargets("cp x.js y.js");
    expect(targets).toContain("y.js");
  });

  test("tee 提取目标文件", () => {
    const targets = extractWriteTargets("echo hello | tee output.js");
    expect(targets).toContain("output.js");
  });

  test("touch 提取目标文件", () => {
    const targets = extractWriteTargets("touch src/new.js");
    expect(targets).toContain("src/new.js");
  });

  // --- fd 重定向排除 ---
  test("2>/dev/null 不被提取", () => {
    const targets = extractWriteTargets("command 2>/dev/null");
    expect(targets).toEqual([]);
  });

  test("2>&1 不被提取", () => {
    const targets = extractWriteTargets("command 2>&1 | grep error");
    expect(targets).toEqual([]);
  });

  test("标准输出重定向仍被提取", () => {
    const targets = extractWriteTargets("echo data > src/config.js");
    expect(targets).toContain("src/config.js");
  });

  // --- 新增提取模式 ---
  test("dd of= 提取目标", () => {
    const targets = extractWriteTargets("dd if=/dev/zero of=src/data.bin bs=1024");
    expect(targets).toContain("src/data.bin");
  });

  test("curl -o 提取目标", () => {
    const targets = extractWriteTargets("curl -o src/config.json https://example.com");
    expect(targets).toContain("src/config.json");
  });

  test("curl --output 提取目标", () => {
    const targets = extractWriteTargets("curl --output lib/data.yaml https://example.com");
    expect(targets).toContain("lib/data.yaml");
  });

  test("wget -O 提取目标", () => {
    const targets = extractWriteTargets("wget -O src/index.html https://example.com");
    expect(targets).toContain("src/index.html");
  });

  test("rsync 提取最后参数", () => {
    const targets = extractWriteTargets("rsync -av src/old.js src/new.js");
    expect(targets).toContain("src/new.js");
  });

  test("install 提取最后参数", () => {
    const targets = extractWriteTargets("install -m 755 build/app src/app");
    expect(targets).toContain("src/app");
  });
});

describe("hasNonOpenSpecWriteTarget", () => {
  test("echo > openspec/file.md → false（全在 openspec 下）", () => {
    const result = hasNonOpenSpecWriteTarget("echo hello > openspec/file.md", "/repo");
    expect(result).toBe(false);
  });

  test("echo > openspec/../src/hack.js → true（路径遍历）", () => {
    const result = hasNonOpenSpecWriteTarget("echo hack > openspec/../src/hack.js", "/repo");
    expect(result).toBe(true);
  });

  test("echo > src/index.js → true（非 openspec 路径）", () => {
    const result = hasNonOpenSpecWriteTarget("echo hello > src/index.js", "/repo");
    expect(result).toBe(true);
  });
});
