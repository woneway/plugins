#!/usr/bin/env node

const { runCli } = require("../lib/cli");

runCli(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
