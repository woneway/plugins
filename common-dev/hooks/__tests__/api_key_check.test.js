const { checkApiKeyInDiff, checkApiKeyInContent } = require("../lib/api_key_check");

// Test key values constructed via concatenation to avoid triggering
// our own API key content check on this test file.
const SK_KEY = "sk-" + "abcdefghijklmnopqrstuvwxyz1234567890";
const GHP_KEY = "ghp_" + "abcdefghijklmnopqrstuvwxyz0123456789";
const GHO_KEY = "gho_" + "abcdefghijklmnopqrstuvwxyz0123456789";
const AKIA_KEY = "AKIA" + "IOSFODNN7EXAMPLE";
const SK_LIVE = "sk_live_" + "abcdefghijklmnopqrstuvwx";
const RK_LIVE = "rk_live_" + "abcdefghijklmnopqrstuvwx";
const SK_TEST = "sk_test_" + "abcdefghijklmnopqrstuvwx";
const XOXB_KEY = "xoxb-" + "1234567890-1234567890123-abcdefghijklmnopqrstuv";
const XOXP_KEY = "xoxp-" + "1234567890-1234567890123-abcdefghijklmnopqrstuv";
const AIZA_KEY = "AIza" + "SyA1234567890abcdefghijklmnopqrstuv";
const NPM_KEY = "npm_" + "abcdefghijklmnopqrstuvwxyz1234567890";
const BEARER_KEY = "Bearer " + "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdefgh";

describe("checkApiKeyInDiff", () => {
  test("检测 ENV_VAR 赋值模式（sk- 前缀）", () => {
    const diff = `+API_KEY="${SK_KEY}"`;
    const result = checkApiKeyInDiff(diff);
    expect(result.found).toBe(true);
    expect(result.count).toBe(1);
  });

  test("检测 sk- 前缀密钥（已知前缀模式）", () => {
    const diff = `+const key = "${SK_KEY}";`;
    const result = checkApiKeyInDiff(diff);
    expect(result.found).toBe(true);
  });

  test("检测 ghp_ GitHub PAT", () => {
    const diff = `+const token = "${GHP_KEY}";`;
    const result = checkApiKeyInDiff(diff);
    expect(result.found).toBe(true);
  });

  test("检测 gho_ GitHub OAuth token", () => {
    const diff = `+const token = "${GHO_KEY}";`;
    const result = checkApiKeyInDiff(diff);
    expect(result.found).toBe(true);
  });

  test("检测 AKIA AWS 密钥", () => {
    const diff = `+AWS_ACCESS_KEY_ID="${AKIA_KEY}"`;
    const result = checkApiKeyInDiff(diff);
    expect(result.found).toBe(true);
  });

  test("检测 Bearer token header", () => {
    const diff = `+const header = "${BEARER_KEY}";`;
    const result = checkApiKeyInDiff(diff);
    expect(result.found).toBe(true);
  });

  test("排除注释行（+# 开头）", () => {
    const diff = `+# API_KEY="${SK_KEY}"`;
    const result = checkApiKeyInDiff(diff);
    expect(result.found).toBe(false);
  });

  test("排除 .example 文件引用", () => {
    const diff = `+See .example file: API_KEY="${SK_KEY}"`;
    const result = checkApiKeyInDiff(diff);
    expect(result.found).toBe(false);
  });

  test("排除短值（< 16 字符）", () => {
    const diff = `+API_KEY="short"`;
    const result = checkApiKeyInDiff(diff);
    expect(result.found).toBe(false);
  });

  test("空输入返回 found: false", () => {
    expect(checkApiKeyInDiff("").found).toBe(false);
    expect(checkApiKeyInDiff(null).found).toBe(false);
    expect(checkApiKeyInDiff(undefined).found).toBe(false);
  });

  test("忽略非新增行（不以 + 开头）", () => {
    const diff = `-API_KEY="${SK_KEY}"`;
    const result = checkApiKeyInDiff(diff);
    expect(result.found).toBe(false);
  });

  test("忽略 +++ 文件头行", () => {
    const diff = `+++ b/config.js\n+API_KEY="${SK_KEY}"`;
    const result = checkApiKeyInDiff(diff);
    expect(result.found).toBe(true);
    expect(result.count).toBe(1);
  });
});

describe("checkApiKeyInContent", () => {
  test("检测内容中的密钥", () => {
    const content = `const key = "${SK_KEY}";`;
    const result = checkApiKeyInContent(content);
    expect(result.found).toBe(true);
  });

  test("排除 JS 注释行", () => {
    const content = `// API_KEY="${SK_KEY}"`;
    const result = checkApiKeyInContent(content);
    expect(result.found).toBe(false);
  });

  test("排除 # 注释行", () => {
    const content = `# API_KEY="${SK_KEY}"`;
    const result = checkApiKeyInContent(content);
    expect(result.found).toBe(false);
  });

  test("空输入返回 found: false", () => {
    expect(checkApiKeyInContent("").found).toBe(false);
    expect(checkApiKeyInContent(null).found).toBe(false);
  });

  // --- 新增前缀测试 ---

  test("检测 Stripe sk_live_ 密钥", () => {
    expect(checkApiKeyInContent(`key = "${SK_LIVE}"`).found).toBe(true);
  });

  test("检测 Stripe rk_live_ 密钥", () => {
    expect(checkApiKeyInContent(`key = "${RK_LIVE}"`).found).toBe(true);
  });

  test("sk_test_ 不触发（test key 可安全提交）", () => {
    expect(checkApiKeyInContent(`key = "${SK_TEST}"`).found).toBe(false);
  });

  test("检测 Slack xoxb- bot token", () => {
    expect(checkApiKeyInContent(`token = "${XOXB_KEY}"`).found).toBe(true);
  });

  test("检测 Slack xoxp- user token", () => {
    expect(checkApiKeyInContent(`token = "${XOXP_KEY}"`).found).toBe(true);
  });

  test("检测 Google AIza API key", () => {
    expect(checkApiKeyInContent(`key = "${AIZA_KEY}"`).found).toBe(true);
  });

  test("检测 npm token", () => {
    expect(checkApiKeyInContent(`token = "${NPM_KEY}"`).found).toBe(true);
  });

  test("现有 sk- 前缀仍然检测", () => {
    expect(checkApiKeyInContent(`key = "${SK_KEY}"`).found).toBe(true);
  });

  test("现有 AKIA 前缀仍然检测", () => {
    expect(checkApiKeyInContent(AKIA_KEY).found).toBe(true);
  });
});
