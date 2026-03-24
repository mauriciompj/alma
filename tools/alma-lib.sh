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
