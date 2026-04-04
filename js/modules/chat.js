/* ALMA v4 — Chat Interface Module */

import { state, MAX_CHARS, CORRECTION_ICON_SVG } from './state.js';
import { sendToBackend } from './api.js';
import { escapeHtml, tt, formatTime, parseMarkdown, scrollToBottom, showError, showTyping, hideTyping, hideSuggestions, createIconFragment } from './ui.js';
import { playVoiceForButton, updateVoiceButtonState } from './voice.js';
import { openCorrectionModal } from './corrections.js';
import { truncateHistory, saveHistory } from './history.js';

// DOM elements — set once from init
var chatMessages, chatInput, sendBtn, charCount, suggestionsEl;

export function setChatDOM(elements) {
  chatMessages = elements.chatMessages;
  chatInput = elements.chatInput;
  sendBtn = elements.sendBtn;
  charCount = elements.charCount;
  suggestionsEl = elements.suggestionsEl;
}

export function handleInputChange() {
  if (state.isReadOnlyConversation) {
    charCount.textContent = '0/' + MAX_CHARS;
    sendBtn.disabled = true;
    return;
  }
  var len = chatInput.value.length;
  charCount.textContent = len + '/' + MAX_CHARS;
  charCount.classList.toggle('warn', len > MAX_CHARS - 50);

  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';

  sendBtn.disabled = len === 0 || len > MAX_CHARS || state.isLoading;
}

export function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) handleSend();
  }
}

export async function handleSend() {
  if (state.isReadOnlyConversation) return;
  var text = chatInput.value.trim();
  if (!text || text.length > MAX_CHARS || state.isLoading) return;

  state.lastQuestion = text;

  addMessage('user', text);
  state.conversationHistory.push({ role: 'user', content: text });

  chatInput.value = '';
  handleInputChange();
  hideSuggestions(suggestionsEl);

  state.isLoading = true;
  sendBtn.disabled = true;
  showTyping(chatMessages);

  try {
    var result = await sendToBackend(text);
    hideTyping();
    var almaMessageEl = addMessage('alma', result.response, result.memoriesUsed, { question: text, showCorrection: state.conversationScope === 'user' });
    state.conversationHistory.push({ role: 'assistant', content: result.response });

    if (state.voiceAvailable && state.voiceEnabled && almaMessageEl) {
      var voiceBtn = almaMessageEl.querySelector('.btn-play-voice');
      if (voiceBtn) {
        playVoiceForButton(voiceBtn, result.response, { forcePlay: true, fromAuto: true }).catch(function () {});
      }
    }
    truncateHistory();
    saveHistory(state.conversationScope);
  } catch (err) {
    hideTyping();
    console.error('ALMA Error:', err);
    showError(err.message || tt('chat.connectionError', null, 'Não consegui responder agora. Tente novamente.'));
  }

  state.isLoading = false;
  sendBtn.disabled = chatInput.value.length === 0;
}

export function addMessage(type, text, memoriesUsed, options) {
  options = options || {};
  var msgEl = document.createElement('div');
  msgEl.className = 'message ' + type;

  var avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  var isChild = state.personType === 'filho';
  if (type === 'user' && state.personPhoto) {
    avatar.style.backgroundImage = 'url(' + state.personPhoto + ')';
    avatar.style.backgroundSize = 'cover';
    avatar.style.backgroundPosition = 'center';
  } else if (type === 'alma' && state.almaPhoto) {
    avatar.style.backgroundImage = 'url(' + state.almaPhoto + ')';
    avatar.style.backgroundSize = 'cover';
    avatar.style.backgroundPosition = 'center';
  } else if (type === 'alma') {
    avatar.textContent = isChild ? (typeof t === 'function' ? t('labels.father') : 'Pai') : state.authorLabel;
    avatar.classList.add('avatar-name');
  } else {
    avatar.textContent = state.personName;
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

  if (type === 'alma' && state.voiceAvailable) {
    var voiceBtn = document.createElement('button');
    voiceBtn.type = 'button';
    voiceBtn.className = 'btn-play-voice';
    updateVoiceButtonState(voiceBtn, 'idle');
    // No individual listener — event delegation on #chatMessages handles all clicks
    content.appendChild(voiceBtn);
  }

  if (type === 'alma' && options.showCorrection !== false && state.conversationHistory.length > 0 && !window.ALMA_HIDE_CORRECTIONS) {
    var corrBtn = document.createElement('button');
    corrBtn.className = 'btn-correct';
    corrBtn.appendChild(createIconFragment(CORRECTION_ICON_SVG));
    corrBtn.appendChild(document.createTextNode(' ' + tt('correction.correctButton', null, 'Corrigir')));
    corrBtn.title = tt('correction.correctButton', null, 'Corrigir');
    corrBtn.addEventListener('click', function () {
      openCorrectionModal(text, options.question || state.lastQuestion);
    });
    content.appendChild(corrBtn);
  }

  msgEl.appendChild(avatar);
  msgEl.appendChild(content);

  chatMessages.appendChild(msgEl);
  scrollToBottom();
  return msgEl;
}

export function renderSavedHistory() {
  var lastUserQuestion = '';
  state.conversationHistory.forEach(function (msg) {
    var type = msg.role === 'user' ? 'user' : 'alma';
    if (msg.role === 'user') {
      state.lastQuestion = msg.content;
      lastUserQuestion = msg.content;
      addMessage(type, msg.content, null, { showCorrection: false });
      return;
    }
    addMessage(type, msg.content, null, { question: lastUserQuestion, showCorrection: state.conversationScope === 'user' });
  });
}

export function clearMessages() {
  if (chatMessages) chatMessages.textContent = '';
}

export function setChatReadOnly(isReadOnly) {
  state.isReadOnlyConversation = !!isReadOnly;
  if (chatInput) {
    chatInput.readOnly = !!isReadOnly;
    chatInput.disabled = !!isReadOnly;
    if (isReadOnly) chatInput.value = '';
  }
  handleInputChange();
}
