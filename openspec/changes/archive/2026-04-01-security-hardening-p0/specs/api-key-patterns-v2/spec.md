## ADDED Requirements

### Requirement: Stripe key detection
`KNOWN_PREFIX_PATTERN` SHALL match Stripe secret keys (`sk_live_`), restricted keys (`rk_live_`), and publishable keys (`pk_live_`) with 24+ alphanumeric characters.

#### Scenario: Stripe secret key detected
- **WHEN** content contains `sk_live_EXAMPLE_NOT_REAL_KEY_24CH`
- **THEN** `checkApiKeyInContent` SHALL return `{ found: true }`

#### Scenario: Stripe restricted key detected
- **WHEN** content contains `rk_live_EXAMPLE_NOT_REAL_KEY_24CH`
- **THEN** `checkApiKeyInContent` SHALL return `{ found: true }`

#### Scenario: Stripe test key not detected
- **WHEN** content contains `sk_test_EXAMPLE_NOT_REAL_KEY_24CH`
- **THEN** `checkApiKeyInContent` SHALL return `{ found: false }` (test keys are safe to commit)

### Requirement: Slack token detection
`KNOWN_PREFIX_PATTERN` SHALL match Slack bot tokens (`xoxb-`) and user tokens (`xoxp-`) with 24+ characters including hyphens.

#### Scenario: Slack bot token detected
- **WHEN** content contains ``xoxb-` followed by numeric-hyphen-alpha sequence (see test fixtures for exact pattern)`
- **THEN** `checkApiKeyInContent` SHALL return `{ found: true }`

#### Scenario: Slack user token detected
- **WHEN** content contains ``xoxp-` followed by numeric-hyphen-alpha sequence (see test fixtures for exact pattern)`
- **THEN** `checkApiKeyInContent` SHALL return `{ found: true }`

### Requirement: Google API key detection
`KNOWN_PREFIX_PATTERN` SHALL match Google API keys starting with `AIza` followed by exactly 35 alphanumeric characters, hyphens, or underscores.

#### Scenario: Google API key detected
- **WHEN** content contains `AIzaSyA1234567890abcdefghijklmnopqrstuv`
- **THEN** `checkApiKeyInContent` SHALL return `{ found: true }`

### Requirement: npm token detection
`KNOWN_PREFIX_PATTERN` SHALL match npm tokens starting with `npm_` followed by 36+ alphanumeric characters.

#### Scenario: npm token detected
- **WHEN** content contains `npm_abcdefghijklmnopqrstuvwxyz1234567890`
- **THEN** `checkApiKeyInContent` SHALL return `{ found: true }`

### Requirement: Existing patterns preserved
All existing detection patterns (sk-, ghp_, gho_, AKIA, ENV_VAR_PATTERN, BEARER_PATTERN) SHALL continue to work unchanged.

#### Scenario: OpenAI key still detected
- **WHEN** content contains `sk-proj-abcdefghijklmnopqrstuvwx`
- **THEN** `checkApiKeyInContent` SHALL return `{ found: true }`

#### Scenario: AWS access key still detected
- **WHEN** content contains `AKIA1234567890ABCDEF`
- **THEN** `checkApiKeyInContent` SHALL return `{ found: true }`
