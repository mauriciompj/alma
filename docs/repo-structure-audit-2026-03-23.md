# ALMA Repository Structure Audit

Date: 2026-03-23

## Scope

This audit reviewed the whole workspace rooted at `PROJETO ALMA`, with special focus on the duplicated application directories `alma/` and `alma-app/`.

## Executive Summary

`alma/` is the canonical application directory and should be treated as the only active app repository.

`alma-app/` is an older snapshot with overlapping code, sensitive files, migration leftovers, and embedded real data. It should not continue to live beside `alma/` as if both were first-class app directories.

The workspace root currently mixes four different concerns:

1. Application source code
2. Production and local artifacts
3. Raw personal/source material
4. Exports, backups, and deploy bundles

That mix is the main reason the repo feels disorganized.

## What Was Verified

### `alma/`

- Has its own Git repository (`alma/.git`)
- Has active commit history
- Has README, localized README, docs, tests, i18n, PWA assets, and clearer `.gitignore`
- Contains the richer implementation:
  - `js/i18n.js`
  - `netlify/functions/alma-voice.mjs`
  - `revisor.html`
  - `setup.html`
  - demo seed scripts
  - tests
- Package scripts are more complete than `alma-app/`

### `alma-app/`

- Looks like a legacy snapshot/prototype branch exported into a folder
- Contains duplicated pages, duplicated Netlify functions, duplicated DB scripts
- Contains operational leftovers:
  - `.env`
  - `SENHAS_USUARIOS.txt`
  - `deploy.sh`
  - `DEPLOY.md`
- Contains data folders and import scripts coupled to private content:
  - `data/relatorio_*.txt`
  - `db/import-relatorios.mjs`
- Contains a large `db/seed.sql` that is not just schema; it includes a data dump with many real document references

## Hard Findings

### 1. `alma` is the real source of truth

Evidence:

- `alma/` has 45 tracked project files outside `node_modules/.netlify/.git`
- `alma-app/` has 28 comparable files
- `alma/` has active Git history and recent cleanup commits
- Nearly every shared file between both trees has diverged

Shared-file comparison summary:

- Same: only `css/admin.css`
- Different: `index.html`, `chat.html`, `admin.html`, `login.html`, `sobre.html`, `css/style.css`, `js/alma.js`, all Netlify functions, DB seed runner, `netlify.toml`, `package.json`

### 2. `alma-app` is unsafe to keep as a peer app directory

Critical reasons:

- Has a real `.env` file in the tree
- Has a credentials file: `SENHAS_USUARIOS.txt`
- Has a huge `db/seed.sql` with embedded data, not only schema
- Has private child report text files in `data/`

This makes `alma-app/` a liability for both accidental deploy confusion and secret/data leakage.

### 3. The workspace root is overloaded

The root contains app code plus:

- Word documents
- JSON exports/backups
- ZIP deploy bundles
- processed WhatsApp exports
- raw new documents in `novos_dados/`
- voice-engine code in `_voice_engine/`

This is valid as a personal project workspace, but it is not a clean application repository layout.

### 4. There is still environment drift in `alma`

`alma/tests/auth.test.mjs` runs, but two checks currently fail against the remote demo:

- health check expects `checks.database` and `checks.anthropic`, but `memories?action=health` currently returns only `status` and `timestamp`
- chat endpoint test expects anonymous access, but `netlify/functions/chat.mjs` now requires auth when DB is configured and returns `401`

So the app structure improved, but docs/tests/environment behavior are not fully aligned.

## Recommended Target Model

Treat `PROJETO ALMA` as a workspace, not as the app repo itself.

Recommended top-level model:

```text
PROJETO ALMA/
├── apps/
│   └── alma/                # the only active app repo
├── data-raw/
│   ├── novos_dados/
│   ├── Filhos/
│   └── Zap/
├── data-processed/
│   └── whatsapp_processados/
├── archives/
│   ├── zips/
│   ├── backups/
│   └── exports/
├── tools/
│   └── voice-engine/
└── notes/
    └── source-docs/
```

If you do not want a big restructure yet, use the minimum viable version:

```text
PROJETO ALMA/
├── alma/
├── _archive/
│   ├── alma-app/
│   ├── zips/
│   ├── deploy-html/
│   └── backups/
├── _data_raw/
├── _data_processed/
└── _tools/
```

## Proposed Actions

### Phase 1: Safety and clarity

1. Keep `alma/` as the only active codebase.
2. Move `alma-app/` to `_archive/alma-app-legacy/`.
3. Remove or securely relocate from `alma-app/` before archiving:
   - `.env`
   - `SENHAS_USUARIOS.txt`
4. Rotate any secret that was ever stored in `alma-app/.env`.
5. Rename the workspace root folders by concern:
   - `novos_dados/` -> `_data_raw/novos_dados/`
   - `whatsapp_processados/` -> `_data_processed/whatsapp/`
   - `_voice_engine/` -> `_tools/voice-engine/`

### Phase 2: Clean boundaries

1. Keep personal source material outside the app repo.
2. Keep generated artifacts outside the app repo:
   - `*.zip`
   - deploy HTML exports
   - JSON backups
3. Keep only sanitized demo/import assets under `alma/`.
4. If child reports are still needed operationally, move them to a private non-repo data area and import from there explicitly.

### Phase 3: App consistency

1. Update `alma/tests/auth.test.mjs` to match current auth requirements, or expose a dedicated anonymous health/demo chat path.
2. Expand health check payload in `netlify/functions/memories.mjs` or relax the test expectation.
3. Document clearly in `README.md` that `alma/` is the repository root for the application.
4. Add a short workspace-level `README` one directory above `alma/` only if this workspace structure is intentionally kept.

## Specific Keep / Move / Archive Decisions

### Keep active in `alma/`

- app HTML/CSS/JS
- `netlify/functions/`
- `db/` schema and import utilities that are generic
- `locales/`
- `docs/`
- tests
- manifest/PWA files

### Move out of `alma/` if they grow

- DB backups in `alma/db/backups/`

Those are better under workspace archives unless they are intentionally versioned examples.

### Archive from `alma-app/`

- all duplicated app pages
- all duplicated Netlify functions
- legacy deploy scripts
- legacy DB migration scripts that are no longer used

### Never keep in active source trees

- real `.env`
- plaintext credentials lists
- raw private reports
- production DB dumps disguised as seed files

## Bottom Line

The organization problem is not `alma` versus `alma-app` as two equal projects.

The real problem is that `alma` is the app, while `alma-app` is legacy material still sitting beside it without a clear status. The correct move is to declare `alma/` canonical, archive `alma-app/`, and separate code from private content and generated artifacts at the workspace root.
