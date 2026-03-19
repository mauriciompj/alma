# ALMA Demo — Setup Guide

This guide walks you through deploying a **demo instance** of ALMA with fictional data. The demo lets people experience the system without exposing any real personal information.

## What's included

- **Fictional father**: Rafael Mendes, civil engineer from Belo Horizonte
- **2 kids**: Lucas (2014) and Helena (2017)
- **16 memories** covering: identity, values, courage, faith, money, kids, relationships, hard moments, practical wisdom
- **2 corrections** (examples of the correction system)
- **3 directives** (global + per-child behavior rules)
- **Demo login credentials** (public, no secrets)

## Step-by-step

### 1. Create a Neon database

Go to [neon.tech](https://neon.tech), create a new project (free tier works), and copy the connection string.

### 2. Seed the demo database

```bash
cd alma-v2
DATABASE_URL="postgresql://your-demo-connection-string" node db/run-seed-demo.mjs
```

### 3. Create a new Netlify site

Go to [app.netlify.com](https://app.netlify.com) and create a new site:

- **Import from Git** → select the same `mauriciompj/alma` repo
- **Base directory**: `alma-v2` (if your repo root isn't alma-v2)
- **Build command**: leave empty or `echo 'Static site'`
- **Publish directory**: `public` (or wherever your HTML files are)

### 4. Set environment variables

In Netlify → Site settings → Environment variables, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your **demo** Neon connection string |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `ALLOWED_ORIGIN` | Your demo site URL (e.g., `https://alma-demo.netlify.app`) |

### 5. Deploy

Trigger a deploy from Netlify. The site should be live.

### 6. Test

Login credentials (all public):

| User | Password | Role |
|---|---|---|
| Lucas | demo123 | Son |
| Helena | demo123 | Daughter |
| Visitante | demo123 | Visitor |
| Admin | demoadmin | Admin panel |

## Important notes

- The demo uses the **same codebase** as production — one `git push` updates both
- The **only difference** is the environment variables (database + CORS origin)
- Demo data is **100% fictional** — no real personal information
- The demo admin password is public; don't store anything sensitive in the demo database
