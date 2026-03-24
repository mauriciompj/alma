#!/data/data/com.termux/files/usr/bin/bash
# ============================================================================
# alma_voz.sh — Ponte Tasker → ALMA (Google Assistant hands-free)
# ============================================================================
# Este script recebe texto do Tasker (via "Ok Google, ALMA [mensagem]")
# e envia direto pro ALMA sem nenhuma interacao.
#
# SETUP:
#   1. Copie para ~/.termux/tasker/:
#      mkdir -p ~/.termux/tasker
#      cp alma_voz.sh ~/.termux/tasker/alma_voz.sh
#      chmod +x ~/.termux/tasker/alma_voz.sh
#
#   2. No Tasker, configure acao Termux:Tasker:
#      Script: alma_voz.sh
#      Arguments: %as_text
#
#   3. Permissoes necessarias:
#      - ~/.termux/termux.properties deve ter: allow-external-apps=true
#      - Tasker precisa da permissao "Run commands in Termux environment"
#
# ============================================================================

MENSAGEM="$1"
if [ -z "$MENSAGEM" ]; then exit 0; fi

# Use alma-send (which handles auth, retry, chunking)
alma-send -s termux_tasker "$MENSAGEM"

# Feedback tactil
command -v termux-vibrate &>/dev/null && termux-vibrate -d 200
