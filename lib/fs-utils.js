const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function pathExists(targetPath) {
  return fs.existsSync(targetPath);
}

function isDirectory(targetPath) {
  return pathExists(targetPath) && fs.statSync(targetPath).isDirectory();
}

function isFile(targetPath) {
  return pathExists(targetPath) && fs.statSync(targetPath).isFile();
}

function listDir(targetPath) {
  return fs.readdirSync(targetPath, { withFileTypes: true });
}

function hashFile(targetPath) {
  const content = fs.readFileSync(targetPath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function copyFileManaged(sourcePath, targetPath) {
  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
  return {
    path: targetPath,
    type: "file",
    hash: hashFile(targetPath),
  };
}

function copyDirRecursive(sourceDir, targetDir, records = []) {
  ensureDir(targetDir);
  for (const entry of listDir(sourceDir)) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(sourcePath, targetPath, records);
    } else if (entry.isFile()) {
      records.push(copyFileManaged(sourcePath, targetPath));
    }
  }
  return records;
}

function removeIfEmpty(targetPath, stopAt) {
  let current = path.dirname(targetPath);
  while (current.startsWith(stopAt) && current !== stopAt) {
    if (!pathExists(current)) {
      current = path.dirname(current);
      continue;
    }
    const entries = fs.readdirSync(current);
    if (entries.length > 0) {
      return;
    }
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}

module.exports = {
  copyDirRecursive,
  copyFileManaged,
  ensureDir,
  hashFile,
  isDirectory,
  isFile,
  pathExists,
  removeIfEmpty,
};
