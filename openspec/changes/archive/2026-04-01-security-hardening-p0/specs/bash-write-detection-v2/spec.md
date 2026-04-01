## ADDED Requirements

### Requirement: dd write target extraction
`extractWriteTargets` SHALL extract the file path from `dd of=<path>` commands.

#### Scenario: dd of= detected
- **WHEN** command is `dd if=/dev/zero of=src/data.bin bs=1024 count=10`
- **THEN** `extractWriteTargets` SHALL return a list containing `src/data.bin`

### Requirement: curl download target extraction
`extractWriteTargets` SHALL extract the file path from `curl -o <path>` and `curl --output <path>` commands.

#### Scenario: curl -o detected
- **WHEN** command is `curl -o src/config.json https://example.com/config`
- **THEN** `extractWriteTargets` SHALL return a list containing `src/config.json`

#### Scenario: curl --output detected
- **WHEN** command is `curl --output lib/data.yaml https://example.com/data`
- **THEN** `extractWriteTargets` SHALL return a list containing `lib/data.yaml`

### Requirement: wget download target extraction
`extractWriteTargets` SHALL extract the file path from `wget -O <path>` and `wget --output-document <path>` commands.

#### Scenario: wget -O detected
- **WHEN** command is `wget -O src/index.html https://example.com`
- **THEN** `extractWriteTargets` SHALL return a list containing `src/index.html`

### Requirement: rsync target extraction
`extractWriteTargets` SHALL extract the last argument from `rsync` commands as the write target.

#### Scenario: rsync detected
- **WHEN** command is `rsync -av src/old.js src/new.js`
- **THEN** `extractWriteTargets` SHALL return a list containing `src/new.js`

### Requirement: install target extraction
`extractWriteTargets` SHALL extract the last argument from `install` commands as the write target.

#### Scenario: install detected
- **WHEN** command is `install -m 755 build/app src/app`
- **THEN** `extractWriteTargets` SHALL return a list containing `src/app`

### Requirement: patch write detection
`isBashWriteCommand` SHALL detect `patch` commands as write operations when the target is a source file or source directory.

#### Scenario: patch detected as write
- **WHEN** command is `patch -p1 < fix.diff`
- **THEN** `isBashWriteCommand` SHALL return `true`

### Requirement: tar extraction detection
`isBashWriteCommand` SHALL detect `tar` extract commands (`tar x`, `tar -x`, `tar xf`, `tar xzf`, `tar --extract`) as write operations.

#### Scenario: tar extract detected as write
- **WHEN** command is `tar xzf archive.tar.gz -C src/`
- **THEN** `isBashWriteCommand` SHALL return `true`

#### Scenario: tar create not detected as write
- **WHEN** command is `tar czf backup.tar.gz src/`
- **THEN** `isBashWriteCommand` SHALL NOT return `true` due to tar detection (may still match other patterns)

### Requirement: Subshell write detection
`isBashWriteCommand` SHALL detect subshell commands (`bash -c`, `sh -c`, `eval`) as write operations when the argument string contains write indicators (`>`, `>>`, `write`, `open(`, `fs.`).

#### Scenario: bash -c with redirect detected
- **WHEN** command is `bash -c "echo secret > src/config.js"`
- **THEN** `isBashWriteCommand` SHALL return `true`

#### Scenario: sh -c with fs.writeFileSync detected
- **WHEN** command is `sh -c "node -e \"fs.writeFileSync('src/x.js','y')\""` 
- **THEN** `isBashWriteCommand` SHALL return `true`

#### Scenario: bash -c without write indicators allowed
- **WHEN** command is `bash -c "echo hello"`
- **THEN** `isBashWriteCommand` SHALL return `false` (no write indicators)

### Requirement: Script interpreter write detection
`isBashWriteCommand` SHALL detect `python -c`, `python3 -c`, `node -e`, `ruby -e`, `perl -e` as write operations when the argument contains write indicators.

#### Scenario: python -c with open() detected
- **WHEN** command is `python -c "open('src/hack.py','w').write('x')"`
- **THEN** `isBashWriteCommand` SHALL return `true`

#### Scenario: node -e with fs detected
- **WHEN** command is `node -e "require('fs').writeFileSync('src/x.js','y')"`
- **THEN** `isBashWriteCommand` SHALL return `true`

#### Scenario: python -c without write indicators allowed
- **WHEN** command is `python -c "print('hello')"`
- **THEN** `isBashWriteCommand` SHALL return `false`

### Requirement: /tmp and /dev exclusions preserved
All new extraction patterns SHALL continue to exclude `/tmp/` and `/dev/` paths from being considered source targets, consistent with existing `isSourceTarget` behavior.

#### Scenario: curl to /tmp not flagged
- **WHEN** command is `curl -o /tmp/download.json https://example.com`
- **THEN** `isBashWriteCommand` SHALL return `false`
