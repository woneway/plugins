// lib/repo_root.js — 获取 git 仓库根目录
//
// 优先用 git rev-parse --show-toplevel 获取真正的 git root，
// 解决 process.cwd() 在子目录时检测到错误 openspec/ 的问题。
// 失败时 fallback 到 process.cwd()。

const { execSync } = require("child_process");

let _cached = null;

function getRepoRoot() {
  if (_cached !== null) return _cached;

  try {
    _cached = execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {
    _cached = process.cwd();
  }

  return _cached;
}

module.exports = { getRepoRoot };
