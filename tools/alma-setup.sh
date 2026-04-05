#!/data/data/com.termux/files/usr/bin/bash
# ============================================================================
# alma-setup.sh — Instala/reinstala TUDO do ALMA no Termux em um comando
# ============================================================================
# Se o celular resetar, Termux reinstalar, ou qualquer coisa quebrar:
#
#   curl -sL https://raw.githubusercontent.com/mauriciompj/alma/main/tools/alma-setup.sh | bash
#
# Isso levanta tudo de volta. So precisa reconfigurar a senha depois.
# ============================================================================

echo ""
echo "=============================="
echo "  ALMA — Setup Completo"
echo "=============================="
echo ""

# 1. Criar diretorios
echo "[1/7] Criando diretorios..."
mkdir -p ~/bin ~/.termux/tasker ~/.shortcuts/tasks ~/.cache

# 2. Permissoes do Termux
echo "[2/7] Configurando permissoes..."
echo "allow-external-apps=true" > ~/.termux/termux.properties
termux-reload-settings 2>/dev/null

# 3. Instalar pacotes
echo "[3/7] Instalando pacotes (jq, curl, termux-api)..."
pkg update -y -q 2>/dev/null
pkg install -y -q jq curl termux-api 2>/dev/null
echo "  Opcionais: pandoc (docx) e poppler (pdf)..."
pkg install -y -q pandoc poppler 2>/dev/null || echo "  (pandoc/poppler nao disponivel, ok)"

# 4. Baixar todos os scripts
echo "[4/7] Baixando scripts do GitHub..."
BASE="https://raw.githubusercontent.com/mauriciompj/alma/main/tools"
SCRIPTS="alma-lib.sh alma-send alma-quick alma-record alma-voice alma-checkin alma-daily-save alma-daily-capture alma-daily-reminder termux-url-opener termux-file-editor termux-file-receiver"
FAIL=0
for f in $SCRIPTS; do
  curl -sL "$BASE/$f" -o ~/bin/$f
  if [ -s ~/bin/$f ]; then
    chmod +x ~/bin/$f
    echo "  OK: $f"
  else
    echo "  FALHOU: $f"
    FAIL=1
  fi
done

# Copiar lib pro PREFIX tambem (widget precisa)
cp ~/bin/alma-lib.sh $PREFIX/bin/alma-lib.sh 2>/dev/null
chmod +x $PREFIX/bin/alma-lib.sh 2>/dev/null

# Tasker bridge
curl -sL "$BASE/alma_voz.sh" -o ~/.termux/tasker/alma_voz.sh
chmod +x ~/.termux/tasker/alma_voz.sh
echo "  OK: alma_voz.sh (Tasker)"

# 5. Widget
echo "[5/7] Configurando widget..."
cp ~/bin/alma-quick ~/.shortcuts/tasks/ALMA
chmod +x ~/.shortcuts/tasks/ALMA
echo "  Widget: ~/.shortcuts/tasks/ALMA"

if command -v termux-job-scheduler >/dev/null 2>&1; then
  ~/bin/alma-daily-reminder --install >/dev/null 2>&1 || true
  echo "  Check-in diario: 21:00"
fi

# 6. Credenciais
echo "[6/7] Verificando credenciais..."
if [ -f ~/.alma-env ]; then
  echo "  ~/.alma-env ja existe. Mantendo."
  grep -q "ALMA_USER" ~/.alma-env && echo "  User: $(grep ALMA_USER ~/.alma-env | cut -d= -f2)"
else
  echo ""
  echo "  ATENCAO: Configure suas credenciais:"
  echo ""
  echo "  cat > ~/.alma-env << 'EOF'"
  echo "  ALMA_URL=https://projeto-alma.netlify.app"
  echo "  ALMA_USER=SeuNome"
  echo "  ALMA_PASS=SuaSenha"
  echo "  EOF"
  echo "  chmod 600 ~/.alma-env"
  echo ""
fi

# 6b. API keys para midia (audio/imagem)
echo "[6b/7] Verificando API keys para midia..."
if [ -f ~/.alma-env ]; then
  if grep -q "GEMINI_API_KEY" ~/.alma-env; then
    echo "  GEMINI_API_KEY: configurada (Gemini — transcricao de audio)"
  else
    echo ""
    echo "  OPCIONAL: Para transcrever audios automaticamente (Gemini):"
    echo "  echo 'GEMINI_API_KEY=AIza...' >> ~/.alma-env"
    echo ""
  fi
  if grep -q "ANTHROPIC_API_KEY" ~/.alma-env; then
    echo "  ANTHROPIC_API_KEY: configurada (Claude Vision — descricao de imagem)"
  else
    echo ""
    echo "  OPCIONAL: Para descrever imagens automaticamente (Claude Vision):"
    echo "  echo 'ANTHROPIC_API_KEY=sk-ant-...' >> ~/.alma-env"
    echo ""
  fi
fi

# 7. Teste
echo "[7/7] Testando conexao..."
if [ -f ~/.alma-env ]; then
  source ~/.alma-env
  RESP=$(curl -s --max-time 10 -X POST "$ALMA_URL/api/auth" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"login\",\"username\":\"$ALMA_USER\",\"password\":\"$ALMA_PASS\"}" 2>/dev/null)
  if echo "$RESP" | jq -r '.success' 2>/dev/null | grep -q "true"; then
    echo "  LOGIN OK!"
  else
    echo "  Login falhou. Verifique ~/.alma-env"
  fi
else
  echo "  Pulando teste (sem ~/.alma-env)"
fi

echo ""
echo "=============================="
echo "  ALMA Setup Completo!"
echo "=============================="
echo ""
echo "Comandos disponiveis:"
echo "  alma-send \"texto\"     — envia texto"
echo "  alma-send -f arq.txt  — envia arquivo"
echo "  alma-quick             — widget de voz"
echo "  alma-daily-reminder    — notifica 'Como foi teu dia?' todo dia"
echo "  alma-daily-capture     — abre a pergunta diaria manualmente"
echo ""
echo "Widget: remova e adicione o Termux:Widget na home screen."
echo "Tasker:  configure alma_voz.sh como acao do Termux:Tasker."
echo ""
if [ $FAIL -eq 1 ]; then
  echo "AVISO: Alguns scripts falharam. Verifique sua conexao e tente de novo."
fi
