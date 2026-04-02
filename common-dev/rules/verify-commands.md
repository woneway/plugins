# Command Verification Rule

Before executing any CLI command you haven't verified in this session:

## Project Commands
1. Check CLAUDE.md for a "## Commands" or "## Common Commands" section
2. Check package.json "scripts" field (Node.js projects)
3. Check Makefile targets (if Makefile exists)
4. If none found, use Glob/Read to find the actual CLI entry point before running it

## External Tool Commands
1. If you're unsure about exact syntax, run `<command> --help` or `<command> -h` first
2. If the tool might not be installed, run `which <command>` first
3. If you're unsure about flags or arguments, search the web rather than guessing
4. Never construct a command from memory if you haven't verified it in this session

## Never
- Guess file paths for CLI entry points (always verify with ls or glob)
- Assume argument syntax without checking (--cli vs -c, positional vs named)
- Combine tool name + subcommand from memory (always verify the subcommand exists)
