# ALMA — Termux Setup Guide

Complete guide for setting up ALMA mobile capture on Android via Termux.

---

## Prerequisites

- **Termux** (from F-Droid, NOT Play Store)
- **Termux:API** (from F-Droid)
- **Termux:Widget** (from F-Droid) — for home screen widget
- **Termux:Tasker** (from F-Droid) — for Google Assistant integration
- **Tasker** (from Play Store) — for "Ok Google" hands-free flow

### Android Settings (do this first)

1. **Settings → Apps** → disable battery optimization ("Unrestricted") for:
   - Termux, Termux:API, Termux:Widget, Termux:Tasker, Tasker
2. **Developer Options** → enable "Disable child process restrictions"

---

## Step 1 — Termux Permissions

```bash
mkdir -p ~/.termux
echo "allow-external-apps=true" > ~/.termux/termux.properties
termux-reload-settings
```

## Step 2 — Install Dependencies

```bash
pkg update && pkg install jq curl termux-api
```

Optional (for file format support):
```bash
pkg install pandoc    # DOCX, ODT, RTF support
pkg install poppler   # PDF support
```

## Step 3 — Download ALMA Scripts

```bash
mkdir -p ~/bin ~/.termux/tasker ~/.shortcuts ~/.cache

curl -sL https://raw.githubusercontent.com/mauriciompj/alma/main/tools/alma-lib.sh -o ~/bin/alma-lib.sh
curl -sL https://raw.githubusercontent.com/mauriciompj/alma/main/tools/alma-send -o ~/bin/alma-send
curl -sL https://raw.githubusercontent.com/mauriciompj/alma/main/tools/alma-quick -o ~/bin/alma-quick
curl -sL https://raw.githubusercontent.com/mauriciompj/alma/main/tools/alma-record -o ~/bin/alma-record
curl -sL https://raw.githubusercontent.com/mauriciompj/alma/main/tools/alma-voice -o ~/bin/alma-voice
curl -sL https://raw.githubusercontent.com/mauriciompj/alma/main/tools/alma_voz.sh -o ~/.termux/tasker/alma_voz.sh
curl -sL https://raw.githubusercontent.com/mauriciompj/alma/main/tools/termux-url-opener -o ~/bin/termux-url-opener
curl -sL https://raw.githubusercontent.com/mauriciompj/alma/main/tools/termux-file-editor -o ~/bin/termux-file-editor

chmod +x ~/bin/alma-lib.sh ~/bin/alma-send ~/bin/alma-quick ~/bin/alma-record ~/bin/alma-voice ~/bin/termux-url-opener ~/bin/termux-file-editor ~/.termux/tasker/alma_voz.sh
```

## Step 4 — Configure Credentials

```bash
cat > ~/.alma-env << 'EOF'
ALMA_URL=https://projeto-alma.netlify.app
ALMA_USER=YourUsername
ALMA_PASS=YourPassword

# Optional: for automatic audio transcription (Whisper)
OPENAI_API_KEY=sk-...

# Optional: for automatic image description (Claude Vision)
ANTHROPIC_API_KEY=sk-ant-...
EOF
chmod 600 ~/.alma-env
```

## Step 5 — Create Home Screen Widget

```bash
ln -sf ~/bin/alma-quick ~/.shortcuts/ALMA
```

Then on your home screen: long press → Widgets → Termux:Widget → select ALMA.

## Step 6 — Test

```bash
# Quick text test
alma-send "Testing ALMA from Termux"

# Voice capture test
alma-quick

# File test
echo "Test file content" > /tmp/test.txt
alma-send -f /tmp/test.txt
```

---

## Google Assistant Integration (Hands-Free)

This enables: **"Ok Google, ALMA [your message]"** → captured and sent automatically.

### Setup

1. **Android Settings → Apps → Tasker → Permissions**
   - Find "Run commands in Termux environment" → **Allow**

2. **Open Tasker** → New Profile:
   - Event: `AutoVoice Recognized` (or Assistant)
   - Command filter: `ALMA *`

3. **Profile Action:**
   - Plugin → **Termux:Tasker**
   - Script: `alma_voz.sh`
   - Arguments: `%avcommnofilter`

4. **Test:** say "Ok Google, ALMA I'm testing the voice module"

### Troubleshooting

| Problem | Solution |
|---|---|
| Tasker: "plugin missing, disabled, not exported or no permission" | Redo Step 1 (termux.properties) and Android permission for Tasker |
| alma_voz.sh not found | Run Step 3 again to re-download |
| Login failed | Check ~/.alma-env credentials |
| "command not found: alma-send" | Ensure ~/bin is in PATH: `echo 'export PATH=$HOME/bin:$PATH' >> ~/.bashrc` |
| Token expired | Token is cached 5 min in ~/.cache/alma_token. Delete it: `rm ~/.cache/alma_token` |
| Whisper failed | Check `OPENAI_API_KEY` in ~/.alma-env. Get one at platform.openai.com |
| Claude Vision failed | Check `ANTHROPIC_API_KEY` in ~/.alma-env. Get one at console.anthropic.com |
| Audio too large | Whisper accepts up to 25MB. Trim the audio before sharing. |
| Falls back to manual | API key missing or network error — check ~/.alma-env and internet |

---

## Script Reference

### Architecture

```
alma-lib.sh              <- shared library (auth cache, retry, helpers)
  |
  |-- alma-send           <- CLI: send text, files, pipe to ALMA
  |-- alma-quick          <- widget: 1-tap voice capture (uses alma-lib.sh)
  |-- alma-record         <- terminal: record audio + transcribe + send
  |-- alma-voice          <- terminal: speech-to-text with confirmation
  |-- alma_voz.sh         <- Tasker bridge: "Ok Google" -> ALMA (uses alma-send)
  |-- termux-url-opener   <- Android Share: text/URLs (delegates to alma-send)
  |-- termux-file-editor  <- Android Share: files (extract + alma-send)
  `-- termux-file-receiver <- legacy (kept for compatibility)
```

### alma-send (main CLI tool)

```bash
alma-send "quick thought"                    # inline text
alma-send -f document.txt                    # send file
alma-send -f doc.txt -t "Title" -c valores   # with title and category
alma-send -f doc.txt -g "tag1,tag2"          # with tags
echo "piped text" | alma-send                # from stdin/pipe
termux-clipboard-get | alma-send             # from clipboard
alma-send -d "dry run test"                  # preview without sending
```

Options:
- `-f <file>` — send file content
- `-t <title>` — custom title (default: auto-generated)
- `-c <category>` — category (default: memorias_pessoais)
- `-g <tags>` — comma-separated tags
- `-s <source>` — source identifier (default: termux)
- `-d` — dry run (show what would be sent)

### alma-quick (1-tap widget)

```bash
alma-quick                    # default category
alma-quick fe                 # specific category
alma-quick valores "My title" # category + custom title
```

Flow: opens Android dialog → tap mic on keyboard → speak → sends automatically.

### alma-record (audio recording)

```bash
alma-record                   # record 15s (default)
alma-record -s 30             # record 30 seconds
alma-record -s 60 -c fe       # 60s with category
alma-record -k                # keep audio file after sending
```

Flow: records audio → transcribes via Android → confirms → sends.

### alma-voice (speech with confirmation)

```bash
alma-voice                    # speak, review, confirm, send
alma-voice -t "Night thought" # with title
alma-voice -c fe -g "prayer"  # with category and tags
```

Flow: opens speech-to-text → shows transcription → asks confirmation → sends.

### alma_voz.sh (Tasker / Google Assistant)

Called automatically by Tasker. Not meant to be run manually.

```bash
# Tasker passes the voice text as $1:
alma_voz.sh "whatever you said to Google Assistant"
```

### termux-url-opener (Android Share → text)

Called automatically when you share text to Termux. Shows category picker, optional title.

### termux-file-editor (Android Share → files)

Called automatically when you share a file to Termux (tap EDIT).

Supported formats:
- `.txt .md .csv .json .log` — sent directly
- `.pdf` — converted via pdftotext
- `.docx .doc .odt .rtf` — converted via pandoc
- `.m4a .ogg .opus .mp3 .wav .aac` — **auto-transcribed via Whisper API** (fallback: manual)
- `.jpg .jpeg .png .gif .webp` — **auto-described via Claude Vision** (fallback: manual)

---

## Media: Audio & Images (automatic)

When you share audio or images from WhatsApp (or any app) to Termux, the processing is automatic:

### How it works
1. **Share** → Termux (or Termux EDIT)
2. **Audio** (.m4a .ogg .opus .mp3 .wav .aac): Whisper API transcribes automatically (~5 seconds)
3. **Images** (.jpg .jpeg .png .gif .webp): Claude Vision describes automatically (~5 seconds)
4. The resulting text is stored in ALMA like any other memory

If the API fails (no key, network error), it falls back to the manual dialog.

### Required API Keys in ~/.alma-env

```bash
OPENAI_API_KEY=sk-...            # Whisper (audio transcription)
ANTHROPIC_API_KEY=sk-ant-...     # Claude Vision (image description)
```

Get your keys at:
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/settings/keys

### Estimated Cost
- Whisper: ~$0.006/minute of audio (~R$0.03 per voice message)
- Claude Vision: ~$0.004/image (~R$0.02 per photo)
- Typical usage (10 audios + 5 photos/day): ~R$2/month

### Limits
- Audio: max 25MB per file (Whisper limit)
- Images: max ~15MB per image (Claude Vision limit)

---

## Data Flow

```
Android (any input method)
  |
  |-- Voice widget ---------> alma-quick ----> alma-lib.sh ----> POST /api/ingest
  |-- "Ok Google, ALMA ..." -> alma_voz.sh --> alma-send ------> POST /api/ingest
  |-- Terminal typing -------> alma-send ----> curl ------------> POST /api/ingest
  |-- Share text ------------> termux-url-opener -> alma-send --> POST /api/ingest
  |-- Share file ------------> termux-file-editor -> alma-send -> POST /api/ingest
  |-- Record audio ----------> alma-record ---> alma-send ------> POST /api/ingest
                                                                      |
                                                                      v
                                                              Netlify Function
                                                                      |
                                                                      v
                                                              Neon PostgreSQL
                                                              (alma_chunks +
                                                               alma_documents)
```

---

## Updating Scripts

To update all scripts to the latest version from GitHub:

```bash
cd ~/bin
for f in alma-lib.sh alma-send alma-quick alma-record alma-voice termux-url-opener termux-file-editor; do
  curl -sL "https://raw.githubusercontent.com/mauriciompj/alma/main/tools/$f" -o "$f"
  chmod +x "$f"
done
curl -sL https://raw.githubusercontent.com/mauriciompj/alma/main/tools/alma_voz.sh -o ~/.termux/tasker/alma_voz.sh
chmod +x ~/.termux/tasker/alma_voz.sh
echo "All scripts updated!"
```

---

## Categories

Available categories for `-c` flag:

| Category | Description |
|---|---|
| `memorias_pessoais` | Personal memories (default) |
| `valores` | Values and principles |
| `fe` | Faith and spirituality |
| `paternidade` | Fatherhood and parenting |
| `relacionamentos` | Relationships |
| `familia` | Family |
| `profissao` | Career and work |
| `trauma` | Hard times and healing |
| `identidade` | Identity |
| `amor` | Love |
| `legado_alma` | About ALMA itself |
| `tecnologia_ia` | Technology and AI |
| `psicologia` | Psychology |
