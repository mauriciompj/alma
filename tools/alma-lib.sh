#!/data/data/com.termux/files/usr/bin/bash
# ============================================================================
# alma-lib.sh — Shared functions for all ALMA Termux tools
# ============================================================================
# Source this file at the top of any alma-* script:
#   source "$(dirname "$0")/alma-lib.sh" 2>/dev/null || source "$PREFIX/bin/alma-lib.sh"
#
# Provides: alma_load_config, alma_login, alma_ingest, alma_toast, alma_auto_title
# ============================================================================

# --- Load config from ~/.alma-env ---
alma_load_config() {
  local env_file="$HOME/.alma-env"
  if [ -f "$env_file" ]; then source "$env_file"; fi
  ALMA_URL="${ALMA_URL:-https://projeto-alma.netlify.app}"
  ALMA_USER="${ALMA_USER:-}"
  ALMA_PASS="${ALMA_PASS:-}"
}

# --- Validate credentials exist ---
alma_check_creds() {
  if [ -z "$ALMA_USER" ] || [ -z "$ALMA_PASS" ]; then
    echo "ERRO: Configure ALMA_USER e ALMA_PASS em ~/.alma-env" >&2
    if command -v termux-toast &>/dev/null; then
      termux-toast -g bottom "ALMA: Configure ~/.alma-env"
    fi
    return 1
  fi
}

# --- Login and get token (cached for 5 min) ---
_ALMA_TOKEN_CACHE="$HOME/.cache/alma_token"
_ALMA_TOKEN_TTL=300

alma_login() {
  # Check cache first
  if [ -f "$_ALMA_TOKEN_CACHE" ]; then
    local age=$(( $(date +%s) - $(stat -c%Y "$_ALMA_TOKEN_CACHE" 2>/dev/null || echo 0) ))
    if [ $age -lt $_ALMA_TOKEN_TTL ]; then
      cat "$_ALMA_TOKEN_CACHE"
      return 0
    fi
  fi

  local resp=$(curl -s --max-time 10 -X POST "$ALMA_URL/api/auth" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"login\",\"username\":\"$ALMA_USER\",\"password\":\"$ALMA_PASS\"}")

  local token=$(echo "$resp" | jq -r '.token // empty')
  if [ -z "$token" ]; then
    local err=$(echo "$resp" | jq -r '.error // "Erro desconhecido"')
    echo "ERRO: Login falhou — $err" >&2
    return 1
  fi

  # Cache token
  mkdir -p "$(dirname "$_ALMA_TOKEN_CACHE")"
  echo -n "$token" > "$_ALMA_TOKEN_CACHE"
  echo "$token"
}

# --- Send content to ALMA (with retry) ---
# Usage: alma_ingest "content" "title" "category" "tags_json" "source"
alma_ingest() {
  local content="$1"
  local title="$2"
  local category="${3:-memorias_pessoais}"
  local tags_json="${4:-[]}"
  local source="${5:-termux}"

  local token=$(alma_login)
  if [ -z "$token" ]; then return 1; fi

  local content_json=$(echo "$content" | jq -Rs .)
  local title_json=$(echo "$title" | jq -Rs .)

  local retry=0
  local max_retry=3
  local success=""
  local resp=""

  while [ $retry -lt $max_retry ]; do
    resp=$(curl -s --max-time 30 -X POST "$ALMA_URL/api/ingest" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $token" \
      -d "{
        \"content\": $content_json,
        \"title\": $title_json,
        \"category\": \"$category\",
        \"tags\": $tags_json,
        \"source\": \"$source\"
      }")

    success=$(echo "$resp" | jq -r '.success // empty')
    if [ "$success" = "true" ]; then break; fi

    retry=$((retry + 1))
    if [ $retry -lt $max_retry ]; then
      sleep $retry
    fi
  done

  if [ "$success" = "true" ]; then
    echo "$resp"
    return 0
  else
    echo "$resp" >&2
    return 1
  fi
}

# --- Toast helpers ---
alma_toast() {
  if command -v termux-toast &>/dev/null; then
    termux-toast -g "${2:-bottom}" "$1"
  else
    echo "$1"
  fi
}

alma_vibrate() {
  command -v termux-vibrate &>/dev/null && termux-vibrate -d "${1:-200}"
}

alma_notify() {
  if command -v termux-notification &>/dev/null; then
    termux-notification --id "${3:-alma}" --title "$1" --content "$2" --group alma
  fi
}

# --- Auto-generate title ---
alma_auto_title() {
  local text="$1"
  local prefix="${2:-Captura}"
  local date_str=$(date +"%Y-%m-%d %H:%M")
  local preview=$(echo "$text" | head -c 50 | tr '\n' ' ')
  echo "$prefix $date_str — $preview..."
}

# --- Transcribe audio file via OpenAI Whisper API ---
# Usage: alma_transcribe_audio "/path/to/audio.ogg"
# Requires: OPENAI_API_KEY in ~/.alma-env
# Returns: transcription text on stdout, empty on failure
alma_transcribe_audio() {
  local file="$1"
  if [ -z "$OPENAI_API_KEY" ]; then
    echo "ERRO: OPENAI_API_KEY nao configurada em ~/.alma-env" >&2
    return 1
  fi
  if [ ! -f "$file" ]; then
    echo "ERRO: Arquivo nao encontrado: $file" >&2
    return 1
  fi

  local filesize
  filesize=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo "0")
  if [ "$filesize" -gt 25000000 ]; then
    echo "ERRO: Arquivo muito grande para Whisper ($filesize bytes, max 25MB)" >&2
    return 1
  fi

  local resp
  resp=$(curl -s --max-time 120 \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -F "file=@$file" \
    -F "model=whisper-1" \
    -F "language=pt" \
    -F "response_format=json" \
    "https://api.openai.com/v1/audio/transcriptions" 2>/dev/null)

  local text
  text=$(echo "$resp" | jq -r '.text // empty' 2>/dev/null)

  if [ -z "$text" ]; then
    local err
    err=$(echo "$resp" | jq -r '.error.message // empty' 2>/dev/null)
    echo "ERRO: Whisper falhou${err:+ — $err}" >&2
    return 1
  fi

  echo "$text"
}

# --- Describe image via Claude Vision API ---
# Usage: alma_describe_image "/path/to/image.jpg"
# Requires: ANTHROPIC_API_KEY in ~/.alma-env
# Returns: description text on stdout, empty on failure
alma_describe_image() {
  local file="$1"
  if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "ERRO: ANTHROPIC_API_KEY nao configurada em ~/.alma-env" >&2
    return 1
  fi
  if [ ! -f "$file" ]; then
    echo "ERRO: Arquivo nao encontrado: $file" >&2
    return 1
  fi

  local mime
  mime=$(file --mime-type -b "$file" 2>/dev/null || echo "image/jpeg")
  case "$mime" in
    image/jpeg|image/png|image/gif|image/webp) ;;
    *) mime="image/jpeg" ;;
  esac

  # Resize if image is too large (Claude Vision limit: 5MB base64)
  local srcfile="$file"
  local tmpresized="/tmp/alma_resized_$$.jpg"
  local filesize
  filesize=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo "0")
  if [ "$filesize" -gt 3500000 ]; then
    rm -f "$tmpresized"
    if command -v ffmpeg &>/dev/null; then
      ffmpeg -y -i "$file" -vf "scale='min(1568,iw)':'min(1568,ih)':force_original_aspect_ratio=decrease" -q:v 4 "$tmpresized" 2>/dev/null
    elif command -v convert &>/dev/null; then
      convert "$file" -resize 1568x1568\> -quality 75 "$tmpresized" 2>/dev/null
    elif command -v python3 &>/dev/null; then
      python3 -c "
from PIL import Image
img = Image.open('$file')
img.thumbnail((1568, 1568))
if img.mode in ('RGBA', 'P'): img = img.convert('RGB')
img.save('$tmpresized', 'JPEG', quality=75)
" 2>/dev/null
    fi
    if [ -s "$tmpresized" ]; then
      srcfile="$tmpresized"
      mime="image/jpeg"
    fi
  fi

  # Encode to base64 via temp file (avoids "Argument list too long")
  local tmpb64=$(mktemp)
  local tmppayload=$(mktemp)
  base64 -w 0 "$srcfile" > "$tmpb64" 2>/dev/null || base64 < "$srcfile" | tr -d '\n' > "$tmpb64"

  local b64size
  b64size=$(stat -c%s "$tmpb64" 2>/dev/null || stat -f%z "$tmpb64" 2>/dev/null || echo "0")
  if [ "$b64size" -gt 5200000 ]; then
    echo "ERRO: Imagem ainda muito grande apos redimensionar ($b64size bytes)" >&2
    rm -f "$tmpb64" "$tmppayload" "$tmpresized"
    return 1
  fi

  # Build JSON payload using --rawfile (reads from file, no arg limit)
  jq -n \
    --rawfile img "$tmpb64" \
    --arg mime "$mime" \
    '{
      "model": "claude-sonnet-4-20250514",
      "max_tokens": 1024,
      "messages": [{
        "role": "user",
        "content": [
          {
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": $mime,
              "data": $img
            }
          },
          {
            "type": "text",
            "text": "Voce faz parte do ALMA, um sistema de legado pessoal. Esta imagem foi compartilhada para ser preservada como memoria.\n\nDescreva esta imagem de forma completa e sensivel, capturando:\n1. O que aparece na imagem (pessoas, lugar, objetos, texto)\n2. O contexto aparente (evento, momento do dia, situacao)\n3. Emocoes ou atmosfera que a imagem transmite\n4. Detalhes que seriam importantes para relembrar este momento no futuro\n\nSe houver texto na imagem (print de conversa, documento, placa), transcreva o texto integralmente.\n\nResponda em portugues, em um ou dois paragrafos descritivos. Nao use formatacao markdown."
          }
        ]
      }]
    }' > "$tmppayload"

  local resp
  resp=$(curl -s --max-time 60 \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d @"$tmppayload" \
    "https://api.anthropic.com/v1/messages" 2>/dev/null)

  rm -f "$tmpb64" "$tmppayload" "$tmpresized"

  local text
  text=$(echo "$resp" | jq -r '.content[0].text // empty' 2>/dev/null)

  if [ -z "$text" ]; then
    local err
    err=$(echo "$resp" | jq -r '.error.message // empty' 2>/dev/null)
    echo "ERRO: Claude Vision falhou${err:+ — $err}" >&2
    return 1
  fi

  echo "$text"
}
