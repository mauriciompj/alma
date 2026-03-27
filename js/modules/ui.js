/* ALMA v4 — UI Utilities Module */

import { state } from './state.js';

// --- HTML escaping ---
export function escapeHtml(str) {
  if (!str) return '';
  var d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

export function escapeHtmlSafe(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Language helpers ---
export function currentLang() {
  return (typeof getCurrentLang === 'function') ? getCurrentLang() : 'pt-BR';
}

export function historyKey(person) {
  var lang = currentLang();
  var suffix = (lang && lang !== 'pt-BR') ? '_' + lang : '';
  return person + suffix;
}

// --- i18n helper ---
export function tt(key, params, fallback) {
  if (typeof t === 'function') {
    var result = t(key, params);
    if (result && result !== key && !result.startsWith(key.split('.')[0] + '.')) return result;
  }
  return fallback || key;
}

// --- Time formatting ---
export function formatTime(date) {
  var locale = currentLang();
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

// --- Scroll ---
export function scrollToBottom() {
  var chatArea = document.querySelector('.chat-area');
  if (chatArea) {
    requestAnimationFrame(function () {
      chatArea.scrollTop = chatArea.scrollHeight;
    });
  }
}

// --- Toast notifications ---
export function showError(msg) {
  showToast(msg, 'error');
}

export function showSuccess(msg) {
  showToast(msg, 'success');
}

export function showToast(msg, type) {
  var existing = document.querySelector('.toast');
  if (existing) existing.remove();

  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = msg;
  document.body.appendChild(toast);

  setTimeout(function () { toast.remove(); }, 4000);
}

// --- Typing indicator ---
export function showTyping(chatMessages) {
  var el = document.createElement('div');
  el.id = 'typingIndicator';
  el.className = 'message alma typing-indicator';
  var avatarHtml;
  if (state.almaPhoto) {
    avatarHtml = '<div class="message-avatar" style="background-image:url(' + state.almaPhoto + ');background-size:cover;background-position:center;"></div>';
  } else {
    var typingLabel = state.personType === 'filho' ? (typeof t === 'function' ? t('labels.father') : 'Pai') : state.authorLabel;
    avatarHtml = '<div class="message-avatar avatar-name">' + typingLabel + '</div>';
  }
  el.innerHTML = avatarHtml + '<div class="typing-dots"><span></span><span></span><span></span></div>';
  chatMessages.appendChild(el);
  scrollToBottom();
}

export function hideTyping() {
  var el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

export function hideSuggestions(suggestionsEl) {
  if (suggestionsEl) suggestionsEl.style.display = 'none';
}

// --- Markdown parser ---
export function parseMarkdown(text) {
  if (!text) return '';
  var s = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__(.+?)__/g, '<strong>$1</strong>');
  s = s.replace(/\*(?!\s)(.+?)(?<!\s)\*/g, '<em>$1</em>');
  s = s.replace(/(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)/g, '<em>$1</em>');
  s = s.replace(/\n\n+/g, '</p><p>');
  s = s.replace(/\n/g, '<br>');
  s = '<p>' + s + '</p>';
  s = s.replace(/<p>\s*<\/p>/g, '');

  return s;
}

// --- DOM helpers ---
export function createIconFragment(svg) {
  return document.createRange().createContextualFragment(svg);
}

export function setStatusBlock(container, text, color) {
  container.textContent = '';
  var block = document.createElement('div');
  block.style.color = color;
  block.style.fontSize = '0.82rem';
  block.style.padding = '8px 0';
  block.textContent = text;
  container.appendChild(block);
}
