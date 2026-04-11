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
    alma_toast "ALMA: Configure ~/.alma-env"
    return 1
  fi
}

# --- Login and get token (cached for 5 min) ---
_ALMA_TOKEN_CACHE="$HOME/.cache/alma_token"
_ALMA_TOKEN_TTL=300

# --- v5 Dual-Save: one-shot state file ---
# Written by alma_transcribe_audio / alma_describe_image after a successful
# upload of the original binary to S3/R2. Consumed (and deleted) by alma_ingest
# in the next call, so the URL gets attached to the chunk row in Neon.
# The subshell issue: TEXT=$(alma_transcribe_audio ...) runs in a subshell, so
# exported globals don't propagate. A filesystem handoff does.
_ALMA_MEDIA_STATE="$HOME/.cache/alma_last_media"

alma_login() {
  # Check cache first
  if [ -f "$_ALMA_TOKEN_CACHE" ]; then
    local age=$(( $(date +%s) - $(stat -c%Y "$_ALMA_TOKEN_CACHE" 2>/dev/null || echo 0) ))
    if [ $age -lt $_ALMA_TOKEN_TTL ]; then
      cat "$_ALMA_TOKEN_CACHE"
      return 0
    fi
  fi

  local resp
  if ! resp=$(curl -s --max-time 10 -X POST "$ALMA_URL/api/auth" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"login\",\"username\":\"$ALMA_USER\",\"password\":\"$ALMA_PASS\"}"); then
    echo "ERRO: Falha de rede no login" >&2
    return 1
  fi

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
# Usage: alma_ingest "content" "title" "category" "tags_json" "source" [media_url] [media_type]
#
# v5 Dual-Save: if media_url/media_type aren't passed explicitly, alma_ingest
# consumes (one-shot) the state file written by alma_transcribe_audio /
# alma_describe_image. The state file is deleted after consumption so a later
# text-only capture doesn't accidentally reattach stale media.
alma_ingest() {
  local content="$1"
  local title="$2"
  local category="${3:-memorias_pessoais}"
  local tags_json="${4:-[]}"
  local source="${5:-termux}"
  local media_url="${6:-}"
  local media_type="${7:-}"

  # Consume one-shot state from transcribe/describe if caller didn't pass explicitly.
  if [ -z "$media_url" ] && [ -f "$_ALMA_MEDIA_STATE" ]; then
    media_url=$(awk 'NR==1' "$_ALMA_MEDIA_STATE" 2>/dev/null)
    media_type=$(awk 'NR==2' "$_ALMA_MEDIA_STATE" 2>/dev/null)
  fi

  local token
  if ! token="$(alma_login)"; then return 1; fi
  if [ -z "$token" ]; then return 1; fi

  local content_json=$(printf '%s' "$content" | jq -Rs .)
  local title_json=$(printf '%s' "$title" | jq -Rs .)

  # Serialize media fields as JSON — null if absent, quoted string if present.
  local media_url_json="null"
  local media_type_json="null"
  if [ -n "$media_url" ]; then
    media_url_json=$(printf '%s' "$media_url" | jq -Rs .)
  fi
  if [ -n "$media_type" ]; then
    media_type_json=$(printf '%s' "$media_type" | jq -Rs .)
  fi

  local retry=0
  local max_retry=3
  local success=""
  local resp=""

  while [ $retry -lt $max_retry ]; do
    if ! resp=$(curl -s --max-time 30 -X POST "$ALMA_URL/api/ingest" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $token" \
      -d "{
        \"content\": $content_json,
        \"title\": $title_json,
        \"category\": \"$category\",
        \"tags\": $tags_json,
        \"source\": \"$source\",
        \"media_url\": $media_url_json,
        \"media_type\": $media_type_json
      }"); then
      resp='{"error":"Falha de rede ao enviar para o ALMA"}'
    fi

    success=$(echo "$resp" | jq -r '.success // empty')
    if [ "$success" = "true" ]; then break; fi

    retry=$((retry + 1))
    if [ $retry -lt $max_retry ]; then
      sleep $retry
    fi
  done

  # One-shot: always clear state file so next ingest starts fresh,
  # regardless of success/failure. Prevents stale-media reattachment.
  rm -f "$_ALMA_MEDIA_STATE" 2>/dev/null

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
    local bg="${ALMA_TOAST_BG:-#17324D}"
    local fg="${ALMA_TOAST_FG:-#F5F7FA}"
    termux-toast -g "${2:-bottom}" -b "$bg" -c "$fg" "$1" 2>/dev/null || \
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

# --- Shared category picker for Termux share flows ---
alma_pick_category() {
  local prompt="${1:-ALMA — Categoria}"
  local dialog index

  dialog=$(termux-dialog sheet -t "$prompt" -v "Memorias pessoais,Valores,Fe,Paternidade,Relacionamentos,Familia,Profissao,Trauma,Identidade,Amor,Legado ALMA,Tecnologia/IA,Psicologia,Cancelar" 2>/dev/null || echo '{"index":-1}')
  index=$(echo "$dialog" | jq -r '.index // -1')

  case "$index" in
    0) echo "memorias_pessoais" ;;
    1) echo "valores" ;;
    2) echo "fe" ;;
    3) echo "paternidade" ;;
    4) echo "relacionamentos" ;;
    5) echo "familia" ;;
    6) echo "profissao" ;;
    7) echo "trauma" ;;
    8) echo "identidade" ;;
    9) echo "amor" ;;
    10) echo "legado_alma" ;;
    11) echo "tecnologia_ia" ;;
    12) echo "psicologia" ;;
    *) return 1 ;;
  esac
}

# --- Auto-generate title ---
alma_auto_title() {
  local text="$1"
  local prefix="${2:-Captura}"
  local date_str=$(date +"%Y-%m-%d %H:%M")
  local preview=$(echo "$text" | head -c 50 | tr '\n' ' ')
  echo "$prefix $date_str — $preview..."
}

# --- Upload original binary to S3/R2 (v5 Dual-Save) ---
# Usage: alma_upload_media "/path/to/file" [mime-type]
# Env required (all in ~/.alma-env):
#   ALMA_S3_BUCKET         — bucket name (e.g. "alma-memorias")
#   ALMA_S3_ENDPOINT       — endpoint URL (e.g. "https://<account>.r2.cloudflarestorage.com")
#   ALMA_S3_PUBLIC_BASE    — public URL prefix (e.g. "https://media.meudominio.com"
#                             or the R2 pub-*.r2.dev URL)
#   AWS_ACCESS_KEY_ID      — aws-cli credentials (R2 token with write access)
#   AWS_SECRET_ACCESS_KEY  —
#   ALMA_S3_PREFIX         — optional key prefix (default: "alma-media/")
#   AWS_REGION             — optional, default "auto" for R2
# Returns: public URL on stdout; empty + non-zero exit on failure (non-fatal).
# Install aws-cli on Termux:  pkg install python && pip install awscli
alma_upload_media() {
  local file="$1"
  local mime="${2:-application/octet-stream}"

  if [ ! -f "$file" ]; then
    echo "ERRO: Arquivo nao encontrado para upload: $file" >&2
    return 1
  fi
  if [ -z "$ALMA_S3_BUCKET" ] || [ -z "$ALMA_S3_ENDPOINT" ] || [ -z "$ALMA_S3_PUBLIC_BASE" ]; then
    echo "AVISO: S3 nao configurado (ALMA_S3_BUCKET/ALMA_S3_ENDPOINT/ALMA_S3_PUBLIC_BASE). Upload ignorado." >&2
    return 1
  fi
  if ! command -v aws &>/dev/null; then
    echo "AVISO: aws-cli nao instalado (pkg install python && pip install awscli). Upload ignorado." >&2
    return 1
  fi

  local prefix="${ALMA_S3_PREFIX:-alma-media/}"
  prefix="${prefix%/}/"
  local base
  base=$(basename "$file")
  # Key: <prefix>YYYY/MM/<epoch>_<basename> — time-partitioned + collision-safe
  local key="${prefix}$(date +%Y/%m)/$(date +%s)_${base}"
  local s3_uri="s3://${ALMA_S3_BUCKET}/${key}"

  # aws-cli writes progress to stderr; --only-show-errors mutes success spam.
  # Region defaults to 'auto' for Cloudflare R2.
  if ! aws s3 cp "$file" "$s3_uri" \
    --endpoint-url "$ALMA_S3_ENDPOINT" \
    --content-type "$mime" \
    --region "${AWS_REGION:-auto}" \
    --only-show-errors >&2; then
    echo "ERRO: Upload S3 falhou para $file" >&2
    return 1
  fi

  local public_base="${ALMA_S3_PUBLIC_BASE%/}"
  echo "${public_base}/${key}"
}

# --- Internal: record dual-save state for the next alma_ingest ---
# Always overwrites. Empty values mean "no media attached to next ingest".
_alma_write_media_state() {
  local url="$1"
  local mime="$2"
  mkdir -p "$(dirname "$_ALMA_MEDIA_STATE")" 2>/dev/null
  printf '%s\n%s\n' "$url" "$mime" > "$_ALMA_MEDIA_STATE" 2>/dev/null || true
}

# --- Transcribe audio file via Google Gemini API ---
# Usage: alma_transcribe_audio "/path/to/audio.ogg"
# Requires: GEMINI_API_KEY in ~/.alma-env
# Returns: transcription text on stdout, empty on failure
#
# DUAL-SAVE CONTRACT (v5): the caller's original binary file is NEVER deleted
# by this function. On successful transcription, the binary is uploaded via
# alma_upload_media() and its public URL + MIME are written to the one-shot
# state file for the next alma_ingest() call to consume.
alma_transcribe_audio() {
  local file="$1"
  if [ -z "$GEMINI_API_KEY" ]; then
    echo "ERRO: GEMINI_API_KEY nao configurada em ~/.alma-env" >&2
    return 1
  fi
  if [ ! -f "$file" ]; then
    echo "ERRO: Arquivo nao encontrado: $file" >&2
    return 1
  fi

  local filesize
  filesize=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo "0")
  if [ "$filesize" -gt 20000000 ]; then
    echo "ERRO: Arquivo muito grande ($filesize bytes, max 20MB)" >&2
    return 1
  fi

  # Detect mime type
  local mime
  mime=$(file --mime-type -b "$file" 2>/dev/null || echo "audio/ogg")
  case "$mime" in
    audio/*) ;;
    *) mime="audio/ogg" ;;
  esac

  # Encode audio to base64 via temp file (avoids Argument list too long)
  local tmpb64=$(mktemp)
  local tmppayload=$(mktemp)
  base64 -w 0 "$file" > "$tmpb64" 2>/dev/null || base64 < "$file" | tr -d '\n' > "$tmpb64"

  jq -n \
    --rawfile audio "$tmpb64" \
    --arg mime "$mime" \
    '{
      "contents": [{
        "parts": [
          {
            "inline_data": {
              "mime_type": $mime,
              "data": $audio
            }
          },
          {
            "text": "Transcreva este audio em portugues. Retorne APENAS o texto transcrito, sem formatacao, sem comentarios, sem markdown."
          }
        ]
      }]
    }' > "$tmppayload"

  local resp
  resp=$(curl -s --max-time 120 \
    -H "Content-Type: application/json" \
    -d @"$tmppayload" \
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$GEMINI_API_KEY" 2>/dev/null)

  rm -f "$tmpb64" "$tmppayload"

  local text
  text=$(echo "$resp" | jq -r '.candidates[0].content.parts[0].text // empty' 2>/dev/null)

  if [ -z "$text" ]; then
    local err
    err=$(echo "$resp" | jq -r '.error.message // empty' 2>/dev/null)
    echo "ERRO: Gemini falhou${err:+ — $err}" >&2
    # Clear any stale dual-save state so a later ingest doesn't attach wrong media
    _alma_write_media_state "" ""
    return 1
  fi

  # v5 Dual-Save: upload ORIGINAL binary (never the resized/normalized copy).
  # Best-effort — if S3 isn't configured or upload fails, we still return the
  # transcription and ingest proceeds text-only (no regression vs. v4 behavior).
  local _media_url=""
  _media_url=$(alma_upload_media "$file" "$mime" 2>/dev/null) || _media_url=""
  _alma_write_media_state "$_media_url" "$mime"

  echo "$text"
}

# --- Describe image via Claude Vision API ---
# Usage: alma_describe_image "/path/to/image.jpg"
# Requires: ANTHROPIC_API_KEY in ~/.alma-env
# Returns: description text on stdout, empty on failure
#
# DUAL-SAVE CONTRACT (v5): the caller's original binary file is NEVER deleted
# by this function. On successful description, the ORIGINAL (not the resized
# copy sent to Claude Vision) is uploaded via alma_upload_media() and its
# public URL + MIME are written to the one-shot state file for the next
# alma_ingest() call to consume.
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
  local tmpresized="${TMPDIR:-/tmp}/alma_resized_$$.jpg"
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
    # Clear any stale dual-save state so a later ingest doesn't attach wrong media
    _alma_write_media_state "" ""
    return 1
  fi

  # v5 Dual-Save: upload the ORIGINAL "$file" (full resolution), NOT "$srcfile"
  # which may be the downsampled $tmpresized variant sent to Claude Vision.
  # We re-detect the true MIME of the original since $mime was normalized to
  # a Claude-compatible subset above.
  local _orig_mime
  _orig_mime=$(file --mime-type -b "$file" 2>/dev/null || echo "$mime")
  local _media_url=""
  _media_url=$(alma_upload_media "$file" "$_orig_mime" 2>/dev/null) || _media_url=""
  _alma_write_media_state "$_media_url" "$_orig_mime"

  echo "$text"
}
