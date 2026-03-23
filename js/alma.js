/* ============================================
   ALMA — A Voice of the Father
   v4.0 — Neon DB + Netlify Functions + RAG + Corrections + Voice (ElevenLabs)
   ============================================ */

(function () {
  'use strict';

  const MAX_HISTORY = 20;
  const KEEP_FIRST = 5;
  const MAX_CHARS = 500;

  // --- State ---
  let conversationHistory = [];
  let isLoading = false;
  let personName = '';
  let personType = ''; // 'filho' (child) or 'outro' (other)
  let lastQuestion = ''; // track for corrections
  let personPhoto = ''; // base64 photo if available
  let almaPhoto = ''; // base64 photo for ALMA avatar
  let authorLabel = 'ALMA'; // default, overwritten by DB on init

  // --- Voice State ---
  let voiceEnabled = localStorage.getItem('alma_voice_enabled') === '1';
  let voiceAvailable = false; // set to true after successful probe
  let currentAudio = null;
  let currentAudioButton = null;
  let voiceNoticeShown = false;
  const voiceCache = new Map();

  // --- Language helper ---
  function currentLang() {
    return (typeof getCurrentLang === 'function') ? getCurrentLang() : 'pt-BR';
  }

  // History key includes person + language to avoid mixing conversations
  function historyKey(person) {
    var lang = currentLang();
    var suffix = (lang && lang !== 'pt-BR') ? '_' + lang : '';
    return person + suffix;
  }
  // --- i18n helper: use t() if available, fallback to default ---
  function tt(key, params, fallback) {
    if (typeof t === 'function') {
      var result = t(key, params);
      if (result && result !== key && !result.startsWith(key.split('.')[0] + '.')) return result;
    }
    return fallback || key;
  }

  // --- Auth helper: include session token in all API calls ---
  function authHeaders() {
    var token = localStorage.getItem('alma_token') || '';
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    };
  }

  // --- DOM Elements ---
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const charCount = document.getElementById('charCount');
  const suggestionsEl = document.getElementById('suggestions');

  // --- Initialize ---
  function init() {
    personName = sessionStorage.getItem('alma_filho') || '';
    personType = sessionStorage.getItem('alma_tipo') || localStorage.getItem('alma_type') || 'outro';
    if (!personName) {
      window.location.href = 'index.html';
      return;
    }

    var isChild = personType === 'filho';
    authorLabel = 'ALMA'; // reset on init, overwritten by DB

    // Set header
    var headerTitle = document.getElementById('headerTitle');
    if (headerTitle) {
      headerTitle.innerHTML = 'ALMA <span>\u00b7 ' + personName + '</span>';
    }

    // Load author name from DB, then set placeholders
    fetch('/.netlify/functions/memories?action=get_persons')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.author) authorLabel = data.author;
        setPlaceholder(isChild, authorLabel);
      })
      .catch(function() { setPlaceholder(isChild, authorLabel); });

    function setPlaceholder(child, author) {
      if (!chatInput) return;
      if (typeof t === 'function' && t('chat.placeholderChild') !== 'chat.placeholderChild') {
        var customPh = t('chat.placeholderCustom.' + personName.toLowerCase());
        chatInput.placeholder = (customPh && !customPh.startsWith('chat.'))
          ? customPh
          : (child ? t('chat.placeholderChild') : t('chat.placeholderOther', { authorName: author }));
      } else {
        chatInput.placeholder = child ? 'Pergunte algo ao seu pai...' : 'Pergunte algo ao ' + author + '...';
      }
    }

    // Update suggestions based on person type (centralized here to avoid race with i18n)
    if (suggestionsEl) {
      var sugList;
      if (isChild) {
        sugList = [
          tt('chat.suggestions.regrets', null, 'Pai, o que você mais se arrepende na vida?'),
          tt('chat.suggestions.rightThing', null, 'Como eu sei quando tô fazendo a coisa certa?'),
          tt('chat.suggestions.beingAMan', null, 'O que você queria que eu soubesse sobre ser homem?'),
          tt('chat.suggestions.fears', null, 'Você tinha medo de alguma coisa?'),
          tt('chat.suggestions.whyAlma', null, 'Por que você fez o ALMA?'),
        ];
      } else {
        sugList = [
          tt('chat.suggestions.values', null, 'O que você mais valoriza na vida?'),
          tt('chat.suggestions.hardTimes', null, 'Como você lida com momentos difíceis?'),
          tt('chat.suggestions.love', null, 'O que você pensa sobre amor?'),
          tt('chat.suggestions.whyAlma', null, 'Por que você fez o ALMA?'),
        ];
      }
      suggestionsEl.innerHTML = sugList.map(function(s) {
        return '<button class="suggestion-btn" data-text="' + s + '">"' + s + '"</button>';
      }).join('');
      // Re-bind suggestion events
      suggestionsEl.querySelectorAll('.suggestion-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          chatInput.value = btn.getAttribute('data-text');
          handleInputChange();
          handleSend();
        });
      });
    }

    // Load history from database (persistent across sessions, per language)
    var hKey = historyKey(personName);
    loadHistoryFromDB(hKey).then(function(dbHistory) {
      if (dbHistory && dbHistory.length > 0) {
        conversationHistory = dbHistory;
        renderSavedHistory();
        hideSuggestions();
      }
    }).catch(function() {
      // Fallback: try sessionStorage
      var saved = sessionStorage.getItem('alma_history_' + hKey);
      if (saved) {
        try {
          conversationHistory = JSON.parse(saved);
          renderSavedHistory();
          hideSuggestions();
        } catch (e) {
          conversationHistory = [];
        }
      }
    });

    // Welcome message if no history — i18n aware
    if (conversationHistory.length === 0) {
      var welcome;
      var hasI18n = (typeof t === 'function' && t('welcome.child') !== 'welcome.child');

      if (hasI18n) {
        // Use translated welcome messages
        welcome = isChild
          ? t('welcome.child', { name: personName })
          : t('welcome.other', { name: personName, authorName: t('labels.authorName') });
      } else {
        // Fallback to hardcoded PT (generic — no personal names)
        if (isChild) {
          welcome = 'Oi, ' + personName + '. Eu sei que talvez voc\u00ea esteja lendo isso daqui alguns anos, talvez eu j\u00e1 n\u00e3o esteja por perto pra responder pessoalmente. Por isso criei isso \u2014 pra voc\u00ea poder me perguntar o que quiser. Pode ser sobre a vida, sobre quem eu fui, sobre o que achei certo ou errado, sobre como agir quando ficar dif\u00edcil. Estou aqui. O que voc\u00ea quer saber?';
        } else {
          welcome = 'Oi, ' + personName + '. Esse \u00e9 o ALMA \u2014 o arquivo de legado emocional. Aqui est\u00e3o as palavras, os valores e as mem\u00f3rias que foram deixadas registradas. Pode perguntar o que quiser.';
        }
      }
      addMessage('alma', welcome);
    }

    // Voice controls
    setupVoiceToggle();

    // Event listeners
    chatInput.addEventListener('input', handleInputChange);
    chatInput.addEventListener('keydown', handleKeyDown);
    sendBtn.addEventListener('click', handleSend);

    // Suggestion button events already bound above in centralized suggestion block

    // Load person photo
    fetch('/.netlify/functions/memories?action=get_config&key=photo_' + personName)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.value) {
          personPhoto = data.value;
          // Update all existing user avatars
          document.querySelectorAll('.message.user .message-avatar').forEach(function(el) {
            el.style.backgroundImage = 'url(' + personPhoto + ')';
            el.style.backgroundSize = 'cover';
            el.textContent = '';
          });
        }
      })
      .catch(function() {});

    // Load ALMA photo (for ALMA message avatars)
    fetch('/.netlify/functions/memories?action=get_config&key=photo_alma')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.value) {
          almaPhoto = data.value;
          // Update all existing ALMA avatars
          document.querySelectorAll('.message.alma .message-avatar').forEach(function(el) {
            el.style.backgroundImage = 'url(' + almaPhoto + ')';
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.textContent = '';
            el.classList.remove('avatar-name');
          });
        }
      })
      .catch(function() {});

    // Create correction modal (once)
    createCorrectionModal();

    // Setup directives panel
    setupDirectivesPanel();

    chatInput.focus();
  }

  // --- Input Handling ---
  function handleInputChange() {
    var len = chatInput.value.length;
    charCount.textContent = len + '/' + MAX_CHARS;
    charCount.classList.toggle('warn', len > MAX_CHARS - 50);

    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';

    sendBtn.disabled = len === 0 || len > MAX_CHARS || isLoading;
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) handleSend();
    }
  }

  // --- Send Message ---
  async function handleSend() {
    var text = chatInput.value.trim();
    if (!text || text.length > MAX_CHARS || isLoading) return;

    // Track question for correction context
    lastQuestion = text;

    // Add user message
    addMessage('user', text);
    conversationHistory.push({ role: 'user', content: text });

    // Clear input
    chatInput.value = '';
    handleInputChange();
    hideSuggestions();

    // Show typing indicator
    isLoading = true;
    sendBtn.disabled = true;
    showTyping();

    try {
      var result = await sendToBackend(text);
      hideTyping();
      var almaMessageEl = addMessage('alma', result.response, result.memoriesUsed);
      conversationHistory.push({ role: 'assistant', content: result.response });

      // Auto-play voice if enabled and available
      if (voiceAvailable && voiceEnabled && almaMessageEl) {
        var voiceBtn = almaMessageEl.querySelector('.btn-play-voice');
        if (voiceBtn) {
          playVoiceForButton(voiceBtn, result.response, { forcePlay: true, fromAuto: true }).catch(function () {});
        }
      }
      truncateHistory();
      saveHistory();
    } catch (err) {
      hideTyping();
      console.error('ALMA Error:', err);
      showError(err.message || tt('chat.connectionError', null, 'Não consegui responder agora. Tente novamente.'));
    }

    isLoading = false;
    sendBtn.disabled = chatInput.value.length === 0;
  }

  // --- Backend Call (Netlify Function) ---
  async function sendToBackend(userMessage) {
    var response = await fetch('/.netlify/functions/chat', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        message: userMessage,
        personName: personName,
        lang: currentLang(),
        birthDate: localStorage.getItem('alma_birthDate') || null,
        history: conversationHistory.filter(function (m) {
          return m.role === 'user' || m.role === 'assistant';
        }),
      }),
    });

    if (!response.ok) {
      var errData = {};
      try { errData = await response.json(); } catch (e) { /* */ }
      throw new Error(errData.error || errData.details || 'Erro ' + response.status);
    }

    return await response.json();
  }

  // --- Message Rendering ---
  function addMessage(type, text, memoriesUsed) {
    var msgEl = document.createElement('div');
    msgEl.className = 'message ' + type;

    var avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    var isChild = personType === 'filho';
    if (type === 'user' && personPhoto) {
      avatar.style.backgroundImage = 'url(' + personPhoto + ')';
      avatar.style.backgroundSize = 'cover';
      avatar.style.backgroundPosition = 'center';
    } else if (type === 'alma' && almaPhoto) {
      avatar.style.backgroundImage = 'url(' + almaPhoto + ')';
      avatar.style.backgroundSize = 'cover';
      avatar.style.backgroundPosition = 'center';
    } else if (type === 'alma') {
      avatar.textContent = isChild ? (typeof t === 'function' ? t('labels.father') : 'Pai') : authorLabel;
      avatar.classList.add('avatar-name');
    } else {
      avatar.textContent = personName;
      avatar.classList.add('avatar-name');
    }

    var content = document.createElement('div');
    content.className = 'message-content';

    var textEl = document.createElement('div');
    textEl.className = 'message-text';
    if (type === 'alma') {
      textEl.innerHTML = parseMarkdown(text);
    } else {
      textEl.textContent = text;
    }

    var timeEl = document.createElement('div');
    timeEl.className = 'message-time';
    var timeText = formatTime(new Date());
    if (type === 'alma' && memoriesUsed && memoriesUsed > 0) {
      timeText += ' \u00b7 ' + tt('chat.memoriesConsulted', { count: memoriesUsed }, memoriesUsed + ' memórias consultadas');
    }
    timeEl.textContent = timeText;

    content.appendChild(textEl);
    content.appendChild(timeEl);

    // Add voice button for ALMA messages (only if voice is available)
    if (type === 'alma' && voiceAvailable) {
      var voiceBtn = document.createElement('button');
      voiceBtn.type = 'button';
      voiceBtn.className = 'btn-play-voice';
      updateVoiceButtonState(voiceBtn, 'idle');
      voiceBtn.addEventListener('click', function () {
        playVoiceForButton(voiceBtn, text).catch(function () {});
      });
      content.appendChild(voiceBtn);
    }

    // Add correction button for ALMA messages (admin only)
    if (type === 'alma' && conversationHistory.length > 0 && !window.ALMA_HIDE_CORRECTIONS) {
      var corrBtn = document.createElement('button');
      corrBtn.className = 'btn-correct';
      corrBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> ' + tt('correction.correctButton', null, 'Corrigir');
      corrBtn.title = tt('correction.correctButton', null, 'Corrigir');
      corrBtn.addEventListener('click', function () {
        openCorrectionModal(text, lastQuestion);
      });
      content.appendChild(corrBtn);
    }

    msgEl.appendChild(avatar);
    msgEl.appendChild(content);

    chatMessages.appendChild(msgEl);
    scrollToBottom();
    return msgEl;
  }

  function renderSavedHistory() {
    conversationHistory.forEach(function (msg, i) {
      var type = msg.role === 'user' ? 'user' : 'alma';
      // Track lastQuestion for correction context
      if (msg.role === 'user') lastQuestion = msg.content;
      addMessage(type, msg.content);
    });
  }

  // ============================================
  // VOICE SYSTEM — ElevenLabs TTS
  // ============================================

  function setupVoiceToggle() {
    var btn = document.getElementById('btnVoiceToggle');
    if (!btn) return;

    // Probe voice endpoint to check if ElevenLabs is configured
    fetch('/.netlify/functions/alma-voice', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ text: '' }), // empty text triggers 400, but 503 means not configured
    }).then(function(r) {
      if (r.status === 503) {
        // Voice not configured — hide all voice UI
        voiceAvailable = false;
        voiceEnabled = false;
        btn.style.display = 'none';
        document.querySelectorAll('.btn-play-voice').forEach(function(b) { b.style.display = 'none'; });
      } else {
        // Voice is available (400 = expected for empty text, 401 = auth issue but configured)
        voiceAvailable = true;
        updateVoiceToggleUI();
        // Retroactively add voice buttons to already-rendered ALMA messages (race condition fix)
        document.querySelectorAll('.message.alma .message-content').forEach(function(content) {
          if (content.querySelector('.btn-play-voice')) return; // already has one
          var textEl = content.querySelector('.message-text');
          if (!textEl) return;
          var msgText = textEl.textContent || '';
          var voiceBtn = document.createElement('button');
          voiceBtn.type = 'button';
          voiceBtn.className = 'btn-play-voice';
          updateVoiceButtonState(voiceBtn, 'idle');
          voiceBtn.addEventListener('click', function () {
            playVoiceForButton(voiceBtn, msgText).catch(function () {});
          });
          // Insert before correction button if present, otherwise append
          var corrBtn = content.querySelector('.btn-correct');
          if (corrBtn) {
            content.insertBefore(voiceBtn, corrBtn);
          } else {
            content.appendChild(voiceBtn);
          }
        });
      }
    }).catch(function() {
      // Network error — hide voice
      voiceAvailable = false;
      btn.style.display = 'none';
    });

    btn.addEventListener('click', function () {
      if (!voiceAvailable) return;
      voiceEnabled = !voiceEnabled;
      localStorage.setItem('alma_voice_enabled', voiceEnabled ? '1' : '0');
      updateVoiceToggleUI();
      if (!voiceEnabled) stopCurrentAudio();
      showSuccess(voiceEnabled
        ? tt('voice.autoEnabled', null, 'Voz automática ativada.')
        : tt('voice.autoDisabled', null, 'Voz automática desativada.'));
    });
  }

  function updateVoiceToggleUI() {
    var btn = document.getElementById('btnVoiceToggle');
    if (!btn) return;
    btn.classList.toggle('active', voiceEnabled);
    btn.setAttribute('aria-pressed', voiceEnabled ? 'true' : 'false');
    var title = voiceEnabled
      ? tt('voice.autoOnTitle', null, 'Voz automática ativada')
      : tt('voice.autoOffTitle', null, 'Ativar voz automática');
    btn.title = title;
    btn.setAttribute('aria-label', title);
  }

  async function playVoiceForButton(btn, text, options) {
    var opts = options || {};

    // Toggle off if already playing this button
    if (!opts.forcePlay && currentAudio && currentAudioButton === btn) {
      stopCurrentAudio();
      return;
    }

    updateVoiceButtonState(btn, 'loading');

    try {
      var audioUrl = await requestVoiceAudio(text);
      await startVoicePlayback(audioUrl, btn);
    } catch (err) {
      console.error('Voice playback failed:', err);
      if (btn && (!currentAudioButton || currentAudioButton !== btn)) {
        updateVoiceButtonState(btn, 'idle');
      }
      // Disable voice if not configured
      if (err && err.code === 'VOICE_NOT_CONFIGURED' && voiceEnabled) {
        voiceEnabled = false;
        localStorage.setItem('alma_voice_enabled', '0');
        updateVoiceToggleUI();
      }
      // Don't show error for autoplay blocks (browser policy)
      if (!(opts.fromAuto && err && err.name === 'NotAllowedError')) {
        showError(err.message || tt('voice.requestError', null, 'Não consegui gerar a voz agora.'));
      } else if (!voiceNoticeShown) {
        voiceNoticeShown = true;
        showError(tt('voice.autoplayBlocked', null, 'O navegador bloqueou a reprodução automática. Toque em Ouvir.'));
      }
      throw err;
    }
  }

  function updateVoiceButtonState(btn, state) {
    if (!btn) return;
    btn.classList.remove('is-loading', 'is-playing');
    if (state === 'loading') {
      btn.classList.add('is-loading');
      btn.disabled = true;
      btn.textContent = tt('voice.loading', null, 'Gerando voz...');
    } else if (state === 'playing') {
      btn.classList.add('is-playing');
      btn.disabled = false;
      btn.textContent = tt('voice.stop', null, 'Parar');
    } else {
      btn.disabled = false;
      btn.textContent = tt('voice.listen', null, 'Ouvir');
    }
  }

  async function requestVoiceAudio(text) {
    var cleanText = (text || '').trim();
    if (!cleanText) {
      var emptyErr = new Error(tt('voice.empty', null, 'Não há texto para narrar.'));
      emptyErr.code = 'VOICE_EMPTY';
      throw emptyErr;
    }

    // Return cached audio if available
    if (voiceCache.has(cleanText)) return voiceCache.get(cleanText);

    var response = await fetch('/.netlify/functions/alma-voice', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ text: cleanText }),
    });

    var data = {};
    try { data = await response.json(); } catch (e) { /* ignore */ }

    if (!response.ok) {
      var err = new Error(data.error || tt('voice.requestError', null, 'Não consegui gerar a voz agora.'));
      err.code = data.code || null;
      throw err;
    }

    if (!data.audio) {
      var noAudioErr = new Error(tt('voice.requestError', null, 'Não consegui gerar a voz agora.'));
      noAudioErr.code = data.code || 'VOICE_EMPTY_RESPONSE';
      throw noAudioErr;
    }

    var audioUrl = 'data:' + (data.mimeType || 'audio/mpeg') + ';base64,' + data.audio;
    voiceCache.set(cleanText, audioUrl);
    return audioUrl;
  }

  async function startVoicePlayback(audioUrl, btn) {
    stopCurrentAudio();
    currentAudio = new Audio(audioUrl);
    currentAudioButton = btn;

    currentAudio.addEventListener('ended', function () {
      if (currentAudioButton === btn) {
        updateVoiceButtonState(btn, 'idle');
        currentAudio = null;
        currentAudioButton = null;
      }
    });

    currentAudio.addEventListener('error', function () {
      if (currentAudioButton === btn) {
        updateVoiceButtonState(btn, 'idle');
        currentAudio = null;
        currentAudioButton = null;
      }
    });

    updateVoiceButtonState(btn, 'playing');
    await currentAudio.play();
  }

  function stopCurrentAudio() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    if (currentAudioButton) {
      updateVoiceButtonState(currentAudioButton, 'idle');
    }
    currentAudio = null;
    currentAudioButton = null;
  }

  // ============================================
  // CORRECTION + DIRECTIVE SYSTEM (Smart Mini-Chat)
  // ============================================

  function createCorrectionModal() {
    var overlay = document.createElement('div');
    overlay.id = 'correctionOverlay';
    overlay.className = 'correction-overlay';
    overlay.innerHTML = [
      '<div class="correction-modal">',
      '  <div class="correction-header">',
      '    <h3>' + tt('correction.title', null, 'Corrigir / Nova diretriz') + '</h3>',
      '    <button class="correction-close" id="correctionClose">&times;</button>',
      '  </div>',
      '  <div class="correction-body">',
      '    <div class="correction-original">',
      '      <label>' + tt('correction.originalLabel', null, 'Resposta original:') + '</label>',
      '      <div class="correction-original-text" id="correctionOriginal"></div>',
      '    </div>',
      '    <div class="correction-input-group">',
      '      <label for="correctionText">' + tt('correction.inputLabel', null, 'O que está errado? Ou que diretriz quer adicionar?') + '</label>',
      '      <textarea id="correctionText" class="correction-textarea" rows="3" maxlength="2000" placeholder="' + tt('correction.inputPlaceholder', null, 'Ex: Essa resposta ficou fria demais, fale com mais calor...') + '"></textarea>',
      '      <span class="correction-char-count" id="correctionCharCount">0/2000</span>',
      '    </div>',
      '    <div id="classifyResult" style="display:none;margin-top:14px;"></div>',
      '  </div>',
      '  <div class="correction-footer">',
      '    <button class="correction-btn-cancel" id="correctionCancel">' + tt('correction.cancelButton', null, 'Cancelar') + '</button>',
      '    <button class="correction-btn-save" id="correctionAnalyze" style="background:var(--blue);border:none;border-radius:8px;color:white;padding:10px 20px;font-size:0.88rem;font-weight:600;cursor:pointer;font-family:inherit;">' + tt('correction.analyzeButton', null, 'Analisar') + '</button>',
      '    <button class="correction-btn-save" id="correctionSave" style="display:none;">' + tt('correction.saveButton', null, 'Salvar') + '</button>',
      '  </div>',
      '</div>'
    ].join('\n');

    document.body.appendChild(overlay);

    // Events
    document.getElementById('correctionClose').addEventListener('click', closeCorrectionModal);
    document.getElementById('correctionCancel').addEventListener('click', closeCorrectionModal);
    document.getElementById('correctionAnalyze').addEventListener('click', classifyInput);
    document.getElementById('correctionSave').addEventListener('click', saveFinalResult);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeCorrectionModal();
    });

    var textarea = document.getElementById('correctionText');
    var charCountEl = document.getElementById('correctionCharCount');
    textarea.addEventListener('input', function () {
      charCountEl.textContent = textarea.value.length + '/2000';
    });
  }

  var correctionOriginalText = '';
  var correctionQuestion = '';
  var classificationResult = null;

  function openCorrectionModal(originalText, question) {
    correctionOriginalText = originalText;
    correctionQuestion = question;
    classificationResult = null;

    var overlay = document.getElementById('correctionOverlay');
    var originalEl = document.getElementById('correctionOriginal');
    var textarea = document.getElementById('correctionText');
    var charCountEl = document.getElementById('correctionCharCount');
    var classifyEl = document.getElementById('classifyResult');
    var analyzeBtn = document.getElementById('correctionAnalyze');
    var saveBtn = document.getElementById('correctionSave');

    // Show truncated original
    var displayText = originalText.length > 300
      ? originalText.substring(0, 300) + '...'
      : originalText;
    originalEl.textContent = displayText;

    textarea.value = '';
    charCountEl.textContent = '0/2000';
    classifyEl.style.display = 'none';
    classifyEl.innerHTML = '';
    analyzeBtn.style.display = '';
    saveBtn.style.display = 'none';

    overlay.classList.add('active');
    setTimeout(function () { textarea.focus(); }, 100);
  }

  function closeCorrectionModal() {
    document.getElementById('correctionOverlay').classList.remove('active');
    classificationResult = null;
  }

  async function classifyInput() {
    var textarea = document.getElementById('correctionText');
    var text = textarea.value.trim();
    if (!text) {
      textarea.style.borderColor = '#D94A4A';
      setTimeout(function () { textarea.style.borderColor = ''; }, 2000);
      return;
    }

    var analyzeBtn = document.getElementById('correctionAnalyze');
    var classifyEl = document.getElementById('classifyResult');
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = tt('correction.analyzing', null, 'Analisando...');
    classifyEl.style.display = '';
    classifyEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;padding:8px 0;">' + tt('correction.analyzingAI', null, 'Analisando com IA...') + '</div>';

    try {
      var response = await fetch('/.netlify/functions/memories', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          action: 'classify_input',
          text: text,
          originalQuestion: correctionQuestion,
          originalResponse: correctionOriginalText,
          personName: personName,
        }),
      });

      var result = await response.json();

      if (result.success && result.classification) {
        classificationResult = result.classification;
        renderClassification(result.classification, text);
      } else {
        // Fallback: treat as correction
        classifyEl.innerHTML = '<div style="color:#f87171;font-size:0.82rem;padding:8px 0;">' + tt('correction.classifyFailed', null, 'Não consegui classificar. Escolha manualmente:') + '</div>';
        renderManualChoice(text);
      }
    } catch (err) {
      classifyEl.innerHTML = '<div style="color:#f87171;font-size:0.82rem;padding:8px 0;">' + tt('correction.networkError', null, 'Erro de rede. Escolha manualmente:') + '</div>';
      renderManualChoice(text);
    }

    analyzeBtn.disabled = false;
    analyzeBtn.textContent = tt('correction.analyzeButton', null, 'Analisar');
    analyzeBtn.style.display = 'none';
    document.getElementById('correctionSave').style.display = '';
  }

  function renderClassification(cls, originalText) {
    var classifyEl = document.getElementById('classifyResult');
    var typeLabels = {
      'correction': tt('correction.types.correction', null, 'Correção'),
      'directive_individual': tt('correction.types.directiveIndividual', null, 'Diretriz individual'),
      'directive_global': tt('correction.types.directiveGlobal', null, 'Diretriz global'),
    };
    var typeColors = {
      'correction': '#D94A4A',
      'directive_individual': '#4A90D9',
      'directive_global': '#E8C547'
    };
    var typeLabel = typeLabels[cls.type] || cls.type;
    var typeColor = typeColors[cls.type] || '#8A8A9A';
    var personLabel = cls.person || 'todos';

    classifyEl.innerHTML =
      '<div style="background:var(--bg);border-radius:10px;padding:14px;border-left:3px solid ' + typeColor + ';">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
          '<span style="font-size:0.75rem;background:' + typeColor + '22;color:' + typeColor + ';padding:2px 10px;border-radius:4px;font-weight:600;">' + typeLabel + '</span>' +
          (cls.person ? '<span style="font-size:0.72rem;color:var(--text-muted);">para ' + cls.person + '</span>' : '') +
        '</div>' +
        '<div style="font-size:0.85rem;color:var(--text);line-height:1.5;margin-bottom:8px;">' +
          '<strong>' + tt('correction.refinedText', null, 'Texto refinado:') + '</strong> ' + escapeHtmlSafe(cls.refined_text || originalText) +
        '</div>' +
        '<div style="font-size:0.78rem;color:var(--text-soft);font-style:italic;">' + escapeHtmlSafe(cls.explanation || '') + '</div>' +
        '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">' +
          '<button class="corr-type-btn" data-type="correction" style="font-size:0.72rem;padding:4px 10px;border-radius:5px;border:1px solid #D94A4A33;background:#D94A4A15;color:#D94A4A;cursor:pointer;font-family:inherit;' + (cls.type === 'correction' ? 'border-color:#D94A4A;font-weight:700;' : '') + '">' + typeLabels['correction'] + '</button>' +
          '<button class="corr-type-btn" data-type="directive_individual" style="font-size:0.72rem;padding:4px 10px;border-radius:5px;border:1px solid #4A90D933;background:#4A90D915;color:#4A90D9;cursor:pointer;font-family:inherit;' + (cls.type === 'directive_individual' ? 'border-color:#4A90D9;font-weight:700;' : '') + '">' + typeLabels['directive_individual'] + ' ' + personLabel + '</button>' +
          '<button class="corr-type-btn" data-type="directive_global" style="font-size:0.72rem;padding:4px 10px;border-radius:5px;border:1px solid #E8C54733;background:#E8C54715;color:#E8C547;cursor:pointer;font-family:inherit;' + (cls.type === 'directive_global' ? 'border-color:#E8C547;font-weight:700;' : '') + '">' + typeLabels['directive_global'] + '</button>' +
        '</div>' +
      '</div>';

    // Type toggle buttons
    classifyEl.querySelectorAll('.corr-type-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        classificationResult.type = btn.dataset.type;
        classifyEl.querySelectorAll('.corr-type-btn').forEach(function(b) {
          b.style.fontWeight = 'normal';
          b.style.borderColor = b.style.color + '33';
        });
        btn.style.fontWeight = '700';
        btn.style.borderColor = btn.style.color;
      });
    });
  }

  function renderManualChoice(text) {
    classificationResult = { type: 'correction', person: personName, refined_text: text, explanation: '' };
    renderClassification(classificationResult, text);
  }

  function escapeHtmlSafe(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function saveFinalResult() {
    var textarea = document.getElementById('correctionText');
    var text = textarea.value.trim();
    if (!text && !classificationResult) return;

    var saveBtn = document.getElementById('correctionSave');
    saveBtn.disabled = true;
    saveBtn.textContent = tt('correction.saving', null, 'Salvando...');

    var cls = classificationResult || { type: 'correction' };
    var finalText = (cls.refined_text || text).trim();

    try {
      if (cls.type === 'correction') {
        // Save as correction (old behavior)
        var response = await fetch('/.netlify/functions/memories', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            action: 'save_correction',
            originalQuestion: correctionQuestion,
            originalResponse: correctionOriginalText,
            correction: finalText,
            personName: personName,
          }),
        });
        var result = await response.json();
        if (result.success) {
          closeCorrectionModal();
          showSuccess(tt('correction.savedCorrection', null, 'Correção salva! As próximas respostas vão considerar isso.'));
        } else {
          showError('Erro: ' + (result.error || ''));
        }
      } else {
        // Save as directive (individual or global)
        var person = cls.type === 'directive_global' ? '_global' : (cls.person || personName);
        var response = await fetch('/.netlify/functions/memories', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            action: 'add_directive',
            person: person,
            directive_text: finalText,
            source: 'chat',
          }),
        });
        var result = await response.json();
        if (result.success) {
          closeCorrectionModal();
          var scopeLabel = cls.type === 'directive_global' ? tt('directives.global', null, 'global') : person;
          showSuccess(tt('correction.savedDirective', { scope: scopeLabel }, 'Diretriz ' + scopeLabel + ' salva! O ALMA vai seguir a partir de agora.'));
        } else {
          showError('Erro: ' + (result.error || ''));
        }
      }
    } catch (err) {
      console.error('Save error:', err);
      showError(tt('correction.saveError', null, 'Erro de conexão. Tente novamente.'));
    }

    saveBtn.disabled = false;
    saveBtn.textContent = tt('correction.saveButton', null, 'Salvar');
  }

  // --- Typing Indicator ---
  function showTyping() {
    var el = document.createElement('div');
    el.id = 'typingIndicator';
    el.className = 'message alma typing-indicator';
    var avatarHtml;
    if (almaPhoto) {
      avatarHtml = '<div class="message-avatar" style="background-image:url(' + almaPhoto + ');background-size:cover;background-position:center;"></div>';
    } else {
      var typingLabel = personType === 'filho' ? (typeof t === 'function' ? t('labels.father') : 'Pai') : authorLabel;
      avatarHtml = '<div class="message-avatar avatar-name">' + typingLabel + '</div>';
    }
    el.innerHTML = avatarHtml + '<div class="typing-dots"><span></span><span></span><span></span></div>';
    chatMessages.appendChild(el);
    scrollToBottom();
  }

  function hideTyping() {
    var el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  function hideSuggestions() {
    if (suggestionsEl) suggestionsEl.style.display = 'none';
  }

  // --- History ---
  function truncateHistory() {
    if (conversationHistory.length > MAX_HISTORY) {
      var first = conversationHistory.slice(0, KEEP_FIRST);
      var recent = conversationHistory.slice(-(MAX_HISTORY - KEEP_FIRST));
      conversationHistory = first.concat(recent);
    }
  }

  function saveHistory() {
    var hKey = historyKey(personName);
    // Save to sessionStorage (immediate fallback)
    try {
      sessionStorage.setItem('alma_history_' + hKey, JSON.stringify(conversationHistory));
    } catch (e) {
      conversationHistory = conversationHistory.slice(-10);
      sessionStorage.setItem('alma_history_' + hKey, JSON.stringify(conversationHistory));
    }
    // Save to database (persistent across sessions) — fire and forget
    saveHistoryToDB(hKey, conversationHistory);
  }

  // --- Markdown Parser ---
  function parseMarkdown(text) {
    if (!text) return '';
    // Escape HTML to prevent XSS
    var s = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold: **text** or __text__
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_ (but not inside words with underscores)
    s = s.replace(/\*(?!\s)(.+?)(?<!\s)\*/g, '<em>$1</em>');
    s = s.replace(/(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)/g, '<em>$1</em>');

    // Line breaks: double newline = paragraph break, single = <br>
    s = s.replace(/\n\n+/g, '</p><p>');
    s = s.replace(/\n/g, '<br>');

    // Wrap in paragraph
    s = '<p>' + s + '</p>';

    // Clean empty paragraphs
    s = s.replace(/<p>\s*<\/p>/g, '');

    return s;
  }

  // --- Utilities ---
  function formatTime(date) {
    var locale = currentLang();
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }

  function scrollToBottom() {
    var chatArea = document.querySelector('.chat-area');
    if (chatArea) {
      requestAnimationFrame(function () {
        chatArea.scrollTop = chatArea.scrollHeight;
      });
    }
  }

  function showError(msg) {
    showToast(msg, 'error');
  }

  function showSuccess(msg) {
    showToast(msg, 'success');
  }

  function showToast(msg, type) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(function () { toast.remove(); }, 4000);
  }

  // --- Directives Panel (individual directives) ---
  function setupDirectivesPanel() {
    var panel = document.getElementById('directivesPanel');
    var overlay = document.getElementById('directivesPanelOverlay');
    var openBtn = document.getElementById('btnDirectives');
    var closeBtn = document.getElementById('directivesPanelClose');

    if (!panel || !openBtn) return;

    // Set person name in panel header
    var nameEl = document.getElementById('directivesPersonName');
    if (nameEl) nameEl.textContent = personName;

    function openPanel() {
      panel.classList.add('open');
      overlay.classList.add('open');
      loadDirectivesList();
    }

    function closePanel() {
      panel.classList.remove('open');
      overlay.classList.remove('open');
    }

    openBtn.addEventListener('click', openPanel);
    closeBtn.addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);

    function loadDirectivesList() {
      var listEl = document.getElementById('chatDirectivesList');
      if (!listEl) return;
      listEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.78rem;">' + tt('directives.loading', null, 'Carregando...') + '</div>';

      fetch('/.netlify/functions/memories?action=list_directives&person=' + encodeURIComponent(personName))
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data.directives || data.directives.length === 0) {
            listEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.78rem;text-align:center;padding:12px 0;">' + tt('directives.empty', null, 'Nenhuma diretriz ainda.') + '</div>';
            return;
          }
          var html = '';
          data.directives.forEach(function(dir) {
            var isGlobal = !dir.person;
            var tagColor = isGlobal ? '#E8C547' : '#4A90D9';
            var tagLabel = isGlobal ? 'Global' : dir.person;
            html += '<div style="background:var(--bg);border-radius:8px;padding:10px 12px;border-left:2px solid ' + tagColor + ';display:flex;align-items:flex-start;gap:8px;">' +
              '<div style="flex:1;">' +
                '<span style="font-size:0.62rem;color:' + tagColor + ';font-weight:600;">' + tagLabel + '</span>' +
                '<div style="font-size:0.82rem;color:var(--text);line-height:1.4;margin-top:2px;">' + escapeHtmlSafe(dir.directive_text) + '</div>' +
              '</div>' +
              '<button onclick="window._deleteDirective(' + dir.id + ')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.9rem;padding:0 2px;line-height:1;" title="' + tt('directives.removeConfirm', null, 'Remover') + '">&times;</button>' +
            '</div>';
          });
          listEl.innerHTML = html;
        })
        .catch(function() {
          listEl.innerHTML = '<div style="color:#f87171;font-size:0.78rem;">' + tt('directives.loadError', null, 'Erro ao carregar') + '</div>';
        });
    }

    // Delete directive from chat panel
    window._deleteDirective = function(id) {
      if (!confirm(tt('directives.removeConfirm', null, 'Remover esta diretriz?'))) return;
      fetch('/.netlify/functions/memories', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'delete_directive', id: id })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.success) loadDirectivesList();
      });
    };

    // Add directive from chat panel
    var addBtn = document.getElementById('chatAddDirBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        var input = document.getElementById('chatNewDirText');
        var text = input.value.trim();
        if (!text) return;

        addBtn.disabled = true;
        fetch('/.netlify/functions/memories', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            action: 'add_directive',
            person: personName,
            directive_text: text,
            source: 'chat'
          })
        }).then(function(r) { return r.json(); }).then(function(data) {
          if (data.success) {
            input.value = '';
            loadDirectivesList();
          }
        }).finally(function() { addBtn.disabled = false; });
      });
    }
  }

  // --- Init ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // --- Persistent History (Database) ---

  var _saveHistoryTimer = null;

  function loadHistoryFromDB(person) {
    return fetch('/.netlify/functions/memories?action=get_history&person=' + encodeURIComponent(person))
      .then(function(r) { return r.json(); })
      .then(function(data) { return data.history || []; });
  }

  function saveHistoryToDB(person, messages) {
    // Debounce: wait 2 seconds after last message before saving to DB
    if (_saveHistoryTimer) clearTimeout(_saveHistoryTimer);
    _saveHistoryTimer = setTimeout(function() {
      fetch('/.netlify/functions/memories', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'save_history', person: person, messages: messages })
      }).catch(function() {}); // Silent fail
    }, 2000);
  }

})();
