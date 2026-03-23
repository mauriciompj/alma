# Contributing to ALMA

First off — thank you. ALMA was born as a deeply personal project, and the fact that you're here means it resonated with you too.

## The spirit of this project

ALMA is an emotional legacy archive. Every contribution should respect that core purpose: helping people preserve their voice, values, and memories for the ones they love.

Before writing code, ask yourself: *"Does this help someone leave something meaningful behind?"*

## How to contribute

### Reporting bugs

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser/environment details

### Suggesting features

Open an issue tagged `feature-request`. Describe the use case — the *why* matters more than the *how*.

### Submitting code

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Test locally (see below)
5. Commit with clear messages
6. Push and open a Pull Request

### Setting up locally

```bash
# Clone your fork
git clone https://github.com/mauriciompj/alma.git
cd alma

# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Fill in your Neon database URL and Anthropic API key

# Start the dev server
npx netlify dev
```

### Running locally

ALMA runs on Netlify Functions. The `netlify dev` command starts a local server that emulates the production environment, including serverless functions.

Visit `http://localhost:8888` after starting.

### Project structure

```
alma/
├── index.html          # Landing page
├── login.html          # Authentication page
├── chat.html           # Main chat interface
├── admin.html          # Admin panel (memories, directives, photos)
├── sobre.html          # About page
├── js/
│   ├── alma.js         # Core frontend logic (chat, corrections, directives)
│   └── i18n.js         # Internationalization system
├── css/
│   ├── style.css       # Main styles (dark theme, responsive)
│   └── admin.css       # Admin panel styles
├── locales/            # i18n translation files
│   ├── pt-BR.json
│   ├── en.json
│   └── es.json
├── netlify/
│   └── functions/
│       ├── chat.mjs    # RAG chat engine + AI personality
│       ├── memories.mjs # Memory CRUD + corrections + directives + persons API
│       └── auth.mjs    # Authentication + session management + rate limiting
├── db/
│   ├── seed.sql        # Database schema (run once to create tables)
│   ├── run-seed.mjs    # Schema runner
│   ├── import-json.mjs # CLI tool to import memory chunks from JSON
│   └── backup.mjs      # Database backup to JSON
├── setup.html          # First-time setup wizard (admin only)
└── manifest.json       # PWA manifest
```

## Guidelines

### Code style

- Functions and comments in English
- UI-facing strings go through the i18n system (`locales/*.json`)
- Portuguese content (memories, prompts, personal context) stays in Portuguese — it's not code, it's legacy
- Keep it simple. ALMA was built without frameworks on purpose

### Commit messages

Write clear, concise commit messages. Examples:
- `add: Hebrew locale (he.json)`
- `fix: chat scroll not reaching bottom on mobile`
- `update: improve welcome message tone for siblings`

### Adding a new language

1. Copy `locales/en.json` to `locales/YOUR_LANG.json`
2. Translate all values (keys stay the same)
3. Update the `meta` section with the correct language code and name
4. Test the interface in that language
5. Submit a PR

### Adding new person types

ALMA adapts its tone based on the relationship (child, sibling, parent, friend). To add a new relationship type:

1. Add the person as a user in `users_json` (via admin panel or DB) with the appropriate `type` field (`filho` or `outro`) and a `description`
2. Person contexts are now built automatically from `users_json` — no code changes needed
3. Optionally, add custom placeholder and welcome messages in all locale files
4. Test the conversational tone — it should feel natural, not robotic

## What we especially welcome

- **New languages** — ALMA should speak every language love speaks
- **Accessibility improvements** — everyone deserves to hear from the people they love
- **Mobile experience** — many users will access this on their phones, in quiet moments
- **Documentation** — help others set up their own ALMA instance
- **Emotional intelligence** — better prompts, warmer responses, more human AI behavior

## What we ask you NOT to do

- Don't add tracking, analytics, or any form of surveillance
- Don't add monetization features
- Don't make it require social media accounts
- Don't strip away the simplicity — ALMA works because it's focused

## Code of Conduct

Be kind. This project exists because someone wanted to leave love behind. Treat every contributor, every issue, and every conversation with the same care.

## Questions?

Open an issue or reach out. We're here.

---

*"I fix what I inherited. I deliver what I never received."*
