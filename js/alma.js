/* ============================================
   ALMA — A Voice of the Father
   v4.0 — Modular ES Modules + Neon DB + Netlify Functions + RAG + Corrections + Voice
   ============================================ */

import { state } from './modules/state.js';
import { authHeaders } from './modules/api.js';
import { escapeHtml, tt, currentLang, historyKey, hideSuggestions } from './modules/ui.js';
import { setChatDOM, handleInputChange, handleKeyDown, handleSend, addMessage, renderSavedHistory } from './modules/chat.js';
import { setupVoiceToggle } from './modules/voice.js';
import { createCorrectionModal } from './modules/corrections.js';
import { setupDirectivesPanel } from './modules/directives.js';
import { loadHistoryFromDB } from './modules/history.js';

// --- DOM Elements ---
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const charCount = document.getElementById('charCount');
const suggestionsEl = document.getElementById('suggestions');

// Pass DOM refs to chat module
setChatDOM({ chatMessages, chatInput, sendBtn, charCount, suggestionsEl });

// --- Initialize ---
function init() {
  state.personName = sessionStorage.getItem('alma_filho') || '';
  state.personType = sessionStorage.getItem('alma_tipo') || localStorage.getItem('alma_type') || 'outro';
  if (!state.personName) {
    window.location.href = 'index.html';
    return;
  }

  var isChild = state.personType === 'filho';
  state.authorLabel = 'ALMA';

  // Set header + person-specific subtitle
  var headerTitle = document.getElementById('headerTitle');
  if (headerTitle) {
    headerTitle.innerHTML = 'ALMA <span>\u00b7 ' + escapeHtml(state.personName) + '</span>';
    // Add personalized subtitle below header if available
    var hasI18nEarly = (typeof t === 'function' && t('subtitles.child') !== 'subtitles.child');
    if (hasI18nEarly) {
      var subKey = 'subtitles.' + state.personName;
      var subVal = t(subKey);
      if (!subVal || subVal === subKey) {
        subVal = isChild ? t('subtitles.child') : t('subtitles.other');
      }
      var subEl = document.getElementById('headerSubtitle');
      if (!subEl) {
        subEl = document.createElement('p');
        subEl.id = 'headerSubtitle';
        subEl.style.cssText = 'color:#A09A8C;font-size:0.7rem;margin:0;letter-spacing:0.5px;font-style:italic;';
        headerTitle.parentNode.insertBefore(subEl, headerTitle.nextSibling);
      }
      subEl.textContent = subVal;
    }
  }

  // Load author name from DB
  fetch('/.netlify/functions/memories?action=get_persons', { headers: authHeaders() })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.author) state.authorLabel = data.author;
      setPlaceholder(isChild, state.authorLabel);
    })
    .catch(function() { setPlaceholder(isChild, state.authorLabel); });

  function setPlaceholder(child, author) {
    if (!chatInput) return;
    if (typeof t === 'function' && t('chat.placeholderChild') !== 'chat.placeholderChild') {
      var customPh = t('chat.placeholderCustom.' + state.personName.toLowerCase());
      chatInput.placeholder = (customPh && !customPh.startsWith('chat.'))
        ? customPh
        : (child ? t('chat.placeholderChild') : t('chat.placeholderOther', { authorName: author }));
    } else {
      chatInput.placeholder = child ? 'Pergunte algo ao seu pai...' : 'Pergunte algo ao ' + author + '...';
    }
  }

  // Update suggestions
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
    suggestionsEl.textContent = '';
    sugList.forEach(function(s) {
      var btn = document.createElement('button');
      btn.className = 'suggestion-btn';
      btn.type = 'button';
      btn.setAttribute('data-text', s);
      btn.textContent = '"' + s + '"';
      btn.addEventListener('click', function () {
        chatInput.value = s;
        handleInputChange();
        handleSend();
      });
      suggestionsEl.appendChild(btn);
    });
  }

  // Load history
  var hKey = historyKey(state.personName);
  if (window.ALMA_DEMO) {
    state.conversationHistory = [];
    sessionStorage.removeItem('alma_history_' + hKey);
  } else {
    loadHistoryFromDB(hKey).then(function(dbHistory) {
      if (dbHistory && dbHistory.length > 0) {
        state.conversationHistory = dbHistory;
        renderSavedHistory();
        hideSuggestions(suggestionsEl);
      }
    }).catch(function() {
      var saved = sessionStorage.getItem('alma_history_' + hKey);
      if (saved) {
        try {
          state.conversationHistory = JSON.parse(saved);
          renderSavedHistory();
          hideSuggestions(suggestionsEl);
        } catch (e) {
          state.conversationHistory = [];
        }
      }
    });
  }

  // Welcome message (person-specific > child/other fallback)
  if (state.conversationHistory.length === 0) {
    var welcome;
    var hasI18n = (typeof t === 'function' && t('welcome.child') !== 'welcome.child');

    if (hasI18n) {
      // Check for person-specific welcome first (e.g. welcome.Nivalda, welcome.Davi)
      var personKey = 'welcome.' + state.personName;
      var personWelcome = t(personKey);
      if (personWelcome && personWelcome !== personKey) {
        welcome = personWelcome;
      } else {
        welcome = isChild
          ? t('welcome.child', { name: state.personName })
          : t('welcome.other', { name: state.personName, authorName: t('labels.authorName') });
      }
    } else {
      if (isChild) {
        welcome = 'Oi, ' + state.personName + '. Eu sei que talvez voc\u00ea esteja lendo isso daqui alguns anos, talvez eu j\u00e1 n\u00e3o esteja por perto pra responder pessoalmente. Por isso criei isso \u2014 pra voc\u00ea poder me perguntar o que quiser. Pode ser sobre a vida, sobre quem eu fui, sobre o que achei certo ou errado, sobre como agir quando ficar dif\u00edcil. Estou aqui. O que voc\u00ea quer saber?';
      } else {
        welcome = 'Oi, ' + state.personName + '. Esse \u00e9 o ALMA \u2014 o arquivo de legado emocional. Aqui est\u00e3o as palavras, os valores e as mem\u00f3rias que foram deixadas registradas. Pode perguntar o que quiser.';
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

  // Load person photo
  fetch('/.netlify/functions/memories?action=get_config&key=photo_' + state.personName, { headers: authHeaders() })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.value) {
        state.personPhoto = data.value;
        document.querySelectorAll('.message.user .message-avatar').forEach(function(el) {
          el.style.backgroundImage = 'url(' + state.personPhoto + ')';
          el.style.backgroundSize = 'cover';
          el.textContent = '';
        });
      }
    })
    .catch(function() {});

  // Load ALMA photo
  fetch('/.netlify/functions/memories?action=get_config&key=photo_alma', { headers: authHeaders() })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.value) {
        state.almaPhoto = data.value;
        document.querySelectorAll('.message.alma .message-avatar').forEach(function(el) {
          el.style.backgroundImage = 'url(' + state.almaPhoto + ')';
          el.style.backgroundSize = 'cover';
          el.style.backgroundPosition = 'center';
          el.textContent = '';
          el.classList.remove('avatar-name');
        });
      }
    })
    .catch(function() {});

  // Create correction modal
  createCorrectionModal();

  // Setup directives panel
  setupDirectivesPanel();

  chatInput.focus();
}

// --- Boot ---
init();
