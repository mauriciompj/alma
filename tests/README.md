## Test Layout

- `auth.test.mjs`: integration/smoke checks for auth, chat, memories, and endpoint security.
- `deep-test.mjs`: broader remote validation for production-like environments.
- `test-utils.mjs`: shared helpers for remote test scripts.

## Safe defaults

- `npm test` runs the demo integration suite.
- `npm run test:integration:prod` points to production but still relies on explicit env vars if protected credentials are needed.
- `npm run test:deep` requires explicit `TEST_USER` and `TEST_PASS`.

## Required env vars

Integration demo:

```powershell
npm test
```

Integration against another target:

```powershell
$env:TEST_URL="https://your-site.netlify.app"
$env:TEST_USER="YourUser"
$env:TEST_PASS="YourPassword"
npm run test:integration
```

Deep test:

```powershell
$env:TEST_URL="https://your-site.netlify.app"
$env:TEST_USER="YourUser"
$env:TEST_PASS="YourPassword"
npm run test:deep
```

Optional legacy passphrase checks:

- `LEGACY_PASSPHRASE_DAVI`
- `LEGACY_PASSPHRASE_NOAH`
- `LEGACY_PASSPHRASE_ISAAC`
- `LEGACY_PASSPHRASE_NATHAN`
- `LEGACY_PASSPHRASE_NIVALDA`
- `LEGACY_PASSPHRASE_LESLEN`
- `LEGACY_PASSPHRASE_CHRIS`
