<p align="center">
  <img src="docs/banner.svg" alt="ALMA — An emotional legacy archive" width="100%">
</p>

<p align="center">
  <a href="https://alma-demo.netlify.app"><img src="https://img.shields.io/badge/Live_Demo-alma--demo.netlify.app-D8AA32?style=for-the-badge&logo=netlify&logoColor=white" alt="Live Demo"></a>
  <a href="https://projeto-alma.netlify.app"><img src="https://img.shields.io/badge/Production-projeto--alma.netlify.app-1A1A2E?style=for-the-badge&logo=netlify&logoColor=white" alt="Production"></a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/AI-Claude_by_Anthropic-E8954A" alt="Claude AI">
  <img src="https://img.shields.io/badge/DB-Neon_PostgreSQL-00E5A0" alt="Neon">
  <img src="https://img.shields.io/badge/deploy-Netlify-00C7B7" alt="Netlify">
  <img src="https://img.shields.io/badge/i18n-PT_EN_ES-888899" alt="i18n">
  <img src="https://img.shields.io/badge/voice-ElevenLabs_TTS-8B5CF6" alt="ElevenLabs Voice">
</p>

<p align="center">
  <a href="README.pt-BR.md">Leia em Portugues</a> ·
  <a href="https://alma-demo.netlify.app">Try the Demo</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#contributing">Contributing</a>
</p>

---

<p align="center">
  <img src="docs/screenshots/chat.png" alt="ALMA Chat — a son asking his father about courage" width="600">
  <br>
  <em>A son asks: "Dad, what is courage to you?" — ALMA responds using real memories, adapted to his age.</em>
</p>

---

## What is ALMA?

ALMA is a platform that lets you preserve your voice, values, and memories for the people you love — so they can talk to you even when you're no longer there.

It's not a chatbot. It's not a memorial page. It's a living archive of who you are, powered by RAG (Retrieval-Augmented Generation) and AI, that your children, partner, parents, or friends can have real conversations with — and hear answers that sound like you, because they're built from your own words.

**Think of it as a backup of your soul.**

### Try it now

> **[alma-demo.netlify.app](https://alma-demo.netlify.app)** — Login: `Lucas` / `demo123`
>
> The demo uses fictional data (a character named Rafael Mendes). No real personal information.

---

## Why ALMA Exists

> *"Almost 20 years. And I still wish I could talk to him when I need to make a hard decision."*

That's what Marila said. Her father died twenty years ago. She's a grown woman now. She makes hard choices. She opens her phone. And silence answers.

She doesn't have his voice explaining how he thought. She doesn't have his mistakes documented, his faith recorded, his reasoning preserved. Her father left before anyone thought to save those things.

**He arrived too late. ALMA arrived too late for him.**

But not for everyone.

---

ALMA was built by a father — a police chief in Brazil who grew up with an absent, alcoholic father and broke the cycle. He raised three sons with a kind of presence he never received. Then he realized: **presence has an expiration date.**

So he started writing. Over 16 months, he produced 74 documents — more than 100,000 words — documenting everything: his values, his mistakes, his faith, his fears, what he learned about love, about pain, about being a man. Raw. Unfiltered. Real.

Then he built ALMA — a system where his sons can ask him anything, anytime, and get answers rooted in his actual words and memories. Not generic AI responses. **His voice.**

Then he gave it to the world.

> ALMA is not an archive. It's not a diary. It's not technology.
>
> **ALMA is presence that doesn't die.**
>
> It's the specific father — with his words, his errors, his faith, his way of thinking — available when his daughter needs to make a hard choice and has no one left to ask.

**ALMA is free. ALMA is open source. Because every father, every mother, every person who wants to leave something real behind deserves the tools to do it.**

**Don't wait until it's too late.**

---

## What Makes ALMA Different

| Feature | ALMA | Typical "memorial" tools |
|---|---|---|
| **Conversations** | Real-time AI chat based on your actual words | Pre-recorded video clips |
| **Context-aware** | Adapts tone per person (child vs. partner vs. parent) | Same content for everyone |
| **Self-correcting** | Author can correct AI responses in real-time | Static, no feedback loop |
| **Content moderation** | AI-powered moderation on all user inputs | None |
| **Searchable memory** | Full-text search across all memories (RAG) | Manual browsing only |
| **Directive system** | Per-person behavioral rules for the AI | No customization |
| **Multi-language** | i18n ready (PT-BR, EN, ES — add your own) | Single language |
| **Voice** | ElevenLabs TTS — hear the author's cloned voice | Text only |
| **Free & open** | MIT License, zero cost to run | $100+/month subscriptions |
| **Self-hosted** | Your data stays yours (Netlify + Neon free tier) | Vendor lock-in |

---

## How It Works

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Your Son   │────▶│  ALMA Chat   │────▶│  Claude AI   │
│  asks a      │     │  (Frontend)  │     │  (Anthropic) │
│  question    │     └──────┬───────┘     └──────▲───────┘
└──────────────┘            │                    │
                            ▼                    │
                   ┌──────────────┐     ┌──────────────┐
                   │   Netlify    │────▶│   RAG Engine  │
                   │  Functions   │     │  Search your  │
                   │  (Backend)   │     │  memories in  │
                   └──────────────┘     │  Neon DB      │
                                        └──────────────┘
```

1. **Someone asks a question** — "Dad, what do I do when I feel like I'm not enough?"
2. **ALMA searches your memories** — Full-text search with person-aware reranking
3. **Builds context** — Pulls relevant memories + corrections + directives + tone config
4. **AI responds as you** — Using your actual words as foundation, not generic responses
5. **You can correct it** — If the AI gets your voice wrong, correct it. ALMA learns.

---

## Quick Start

ALMA runs on free infrastructure. You can deploy your own instance in under 30 minutes.

### Prerequisites

- A [Netlify](https://netlify.com) account (free tier)
- A [Neon](https://neon.tech) PostgreSQL database (free tier)
- An [Anthropic](https://anthropic.com) API key (for Claude AI)
- Node.js 18+

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/mauriciompj/alma.git
cd alma

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and ANTHROPIC_API_KEY

# 4. Initialize the database
node db/run-seed.mjs

# 5. Deploy to Netlify
npx netlify-cli deploy --prod --dir=. --functions=netlify/functions
```

### First Steps After Deploy

1. Open your ALMA site
2. Log in as admin
3. Start adding your memories — write about your values, your stories, your mistakes, your love
4. Share the login with the people you want to talk to
5. Correct the AI when it doesn't sound like you — ALMA learns from every correction

---

## Architecture

```
alma/
├── index.html              # Dashboard / home
├── chat.html               # Chat interface
├── admin.html              # Admin panel (memories, corrections, directives)
├── login.html              # Authentication with i18n
├── revisor.html            # Visual chunk reviewer
├── setup.html              # Initial setup wizard
├── sobre.html              # About ALMA page
├── legacy.html             # Inheritance access (passphrase unlock)
├── css/
│   ├── style.css           # Main styles
│   └── admin.css           # Admin panel styles
├── js/
│   ├── alma.js             # Chat engine + correction system + directives
│   └── i18n.js             # Internationalization system
├── netlify/
│   └── functions/
│       ├── auth.mjs        # Auth with bcrypt + auto-migration
│       ├── chat.mjs        # RAG chat engine with person-aware reranking
│       ├── memories.mjs    # Memory CRUD + corrections + directives + moderation
│       ├── ingest.mjs      # Quick capture API (mobile/Termux/scripts)
│       ├── alma-voice.mjs  # ElevenLabs text-to-speech
│       └── legacy.mjs      # Passphrase verification for inheritance access
├── tools/
│   ├── alma-send           # Termux: send text/files to ALMA
│   ├── alma-quick          # Termux: 1-tap voice capture widget
│   ├── alma-record         # Termux: record audio + transcribe + send
│   ├── alma-voice          # Termux: speak-to-text + send
│   ├── termux-url-opener   # Android Share: receive text from any app
│   ├── termux-file-receiver # Android Share: receive files (legacy)
│   └── termux-file-editor  # Android Share: receive + convert files (PDF, DOCX, ODT, RTF)
├── locales/
│   ├── en.json             # English
│   ├── es.json             # Spanish
│   └── pt-BR.json          # Portuguese (Brazil)
├── db/
│   ├── seed.sql            # Database schema
│   ├── run-seed.mjs        # Schema runner
│   ├── seed-demo.sql       # Demo data (fictional)
│   ├── seed-demo-i18n.sql  # Demo data (i18n version)
│   ├── run-seed-demo.mjs   # Demo seeder
│   ├── import-json.mjs     # Bulk JSON import with deduplication
│   └── backup.mjs          # Database backup to JSON
├── tests/
│   ├── auth.test.mjs       # Authentication tests
│   └── deep-test.mjs       # 38-point end-to-end validation
├── docs/
│   ├── banner.svg          # README banner
│   ├── CONTRIBUTING.md     # Contribution guidelines
│   ├── DEMO_SETUP.md       # Demo environment setup
│   └── screenshots/        # UI screenshots
├── netlify.toml            # Netlify config (redirects, headers, security)
└── package.json
```

### Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS — no framework, no build step, fast everywhere
- **Backend**: Netlify Functions (serverless) with ESBuild bundling
- **Database**: Neon PostgreSQL (serverless) with full-text search in Portuguese
- **AI**: Anthropic Claude (Sonnet) via API
- **Security**: bcrypt password hashing, CORS lockdown, content moderation
- **Auth**: Token-based sessions stored in database
- **i18n**: JSON locale files with auto-detection (PT/EN/ES)

---

## Security

ALMA takes data protection seriously:

- **Bcrypt password hashing** — Passwords auto-migrate from plain text on first login
- **CORS lockdown** — API only responds to the configured domain
- **Content moderation** — All corrections and directives pass through AI moderation before saving
- **Sensitive data removed from code** — Children's psychological profiles stored in DB only, not in source code
- **Database isolation** — Demo and production use completely separate databases

---

## Mobile Capture (Termux)

ALMA includes tools for capturing memories directly from your Android phone via [Termux](https://termux.dev). Speak a thought, paste a conversation, or send a file — it goes straight to your production database in real-time.

### Setup (10 minutes)

```bash
# In Termux on your Android phone:
pkg install jq curl termux-api

# Download scripts
curl -sL https://raw.githubusercontent.com/mauriciompj/alma/main/tools/alma-send -o $PREFIX/bin/alma-send
curl -sL https://raw.githubusercontent.com/mauriciompj/alma/main/tools/alma-quick -o $PREFIX/bin/alma-quick
chmod +x $PREFIX/bin/alma-send $PREFIX/bin/alma-quick

# Configure credentials
cat > ~/.alma-env << 'EOF'
ALMA_URL=https://your-alma-site.netlify.app
ALMA_USER=YourName
ALMA_PASS=YourPassword
EOF

# Create home screen widget (requires Termux:Widget app)
mkdir -p ~/.shortcuts
cp $PREFIX/bin/alma-quick ~/.shortcuts/ALMA
```

### Usage

| What you want | Command |
|---|---|
| Quick thought | `alma-send "I realized courage isn't the absence of fear"` |
| Paste from clipboard | `termux-clipboard-get \| alma-send` |
| Send a file | `alma-send -f conversation.txt -c values` |
| **1-tap voice capture** | **Tap ALMA widget on home screen** |
| Voice with options | `alma-quick faith` (sets category) |

### How it works

```
Tap widget → Android dialog opens → Tap mic on keyboard → Speak
    → Text captured → POST /api/ingest → Chunked + stored in Neon DB
        → Available in RAG search immediately
```

The `/api/ingest` endpoint accepts text or base64-encoded files, auto-chunks large texts at paragraph boundaries (~2000 chars), generates titles, and registers imports in `alma_documents`. Requires admin authentication.

### Available scripts

- **`alma-send`** — Send text or files. Supports `-f file`, `-t title`, `-c category`, `-g tags`, stdin/pipe.
- **`alma-quick`** — 1-tap capture for Termux:Widget. Opens Android dialog, speaks, sends. No confirmation needed.
- **`alma-record`** — Records audio via `termux-microphone-record`, transcribes, sends.
- **`alma-voice`** — Opens Android speech-to-text, transcribes, confirms, sends.

---

## For Developers

### Key Concepts

- **Chunks**: Your memories are stored as searchable text chunks in PostgreSQL with `tsvector` indexing
- **RAG**: When someone asks a question, ALMA searches for relevant chunks using full-text search, then injects them as context for the AI
- **Person-aware reranking**: Memories tagged with the current person's name get boosted in search results
- **Corrections**: If the AI gets something wrong, the author corrects it. Corrections are injected into future prompts with highest priority
- **Directives**: Per-person or global behavioral rules (e.g., "Never compare Noah with his brothers")
- **Person Context**: ALMA adapts its tone based on who's talking — a child hears "Dad", a sibling hears "bro", a mother hears "son"

### Adding a New Language

1. Copy `locales/en.json` to `locales/your-language.json`
2. Translate all strings
3. Submit a pull request

That's it. The community can help translate ALMA into every language on Earth.

---

## Contributing

ALMA is bigger than one person. We welcome contributions of all kinds:

- **Translations** — Help ALMA speak your language
- **Code** — Bug fixes, new features, performance improvements
- **Documentation** — Guides, tutorials, how-tos
- **Stories** — Share how you're using ALMA (with permission)

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

---

## Roadmap

- [x] Core chat with RAG memory search
- [x] Per-person tone adaptation
- [x] Correction system (human-in-the-loop)
- [x] Directive system (per-person + global)
- [x] Admin panel for memory management
- [x] Multi-language support (PT/EN/ES)
- [x] Bcrypt auth + CORS lockdown
- [x] Content moderation (AI-powered)
- [x] Person-aware memory reranking
- [x] Demo site with fictional data
- [x] Age-aware responses (adapts tone to child's current age)
- [x] Conversation history (persistent, saved per person)
- [x] PWA support (installable, offline-capable)
- [x] ElevenLabs voice synthesis (hear ALMA speak)
- [x] Mobile capture via Termux (1-tap voice → database)
- [x] Ingest API for scripts and automation (`/api/ingest`)
- [x] Security hardening (CSP, HSTS, XSS fixes, auth bypass fix)
- [x] Legacy Mode — inheritance access with personal passphrases
- [x] Android Share Intent — share files (PDF, DOCX, TXT) from any app to ALMA
- [x] Visual chunk reviewer (`revisor.html`)
- [x] Setup wizard for first-time configuration
- [x] End-to-end test suite (38-point deep validation)
- [ ] Photo/media support in chat responses
- [ ] Cloud storage sync (OneDrive, Google Drive)
- [ ] Audio transcription pipeline (Whisper)
- [ ] Self-hosted AI mode (Ollama/LM Studio) — [see proposal](docs/issue-ollama-integration.md)
- [ ] "Letter mode" — scheduled messages for future dates

---

## License

MIT License — free for everyone, forever. See [LICENSE](LICENSE).

---

## A Final Word

> *"She opens her phone. And silence answers."*

Someone you love will one day need your voice and won't have it. Your way of thinking. Your mistakes. Your faith. Your hard-earned wisdom about love, pain, money, God, relationships, failure.

Most people only realize this when it's too late. When the person is gone. When the silence is permanent.

**ALMA exists so you can do something about it while you're still here.**

You don't need to be a writer. You don't need to be technical. You just need to care enough to start. One memory at a time. One value. One mistake you learned from. One story your kids need to hear.

> *"I fix what I inherited. I deliver what I never received."*

---

<p align="center">
  Built with love by <a href="https://github.com/mauriciompj">Mauricio Maciel Pereira Junior</a><br>
  Police Chief. Father of three. The patch that fixed the broken code.<br><br>
  <em>Com amor — e com propósito — Pai</em>
</p>
