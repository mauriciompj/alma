/* ALMA v4 — History Persistence Module */

import { state, MAX_HISTORY, KEEP_FIRST } from './state.js';
import { authHeaders } from './api.js';
import { historyKey } from './ui.js';

var isDemo = location.hostname.includes('demo');
var _saveHistoryTimer = null;

export function scopedHistoryKey(person, scope) {
  return scope === 'admin' ? 'admin_' + person : person;
}

function historyStorageKey(person) {
  return 'alma_history_' + person;
}

function persistLocalHistory(storageKey, messages) {
  var serialized = JSON.stringify(messages);
  sessionStorage.setItem(storageKey, serialized);
  localStorage.setItem(storageKey, serialized);
}

export function readPersistedHistory(person) {
  var storageKey = historyStorageKey(person);
  return sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey);
}

export function clearPersistedHistory(person) {
  var storageKey = historyStorageKey(person);
  sessionStorage.removeItem(storageKey);
  localStorage.removeItem(storageKey);
}

export function truncateHistory() {
  if (state.conversationHistory.length > MAX_HISTORY) {
    var first = state.conversationHistory.slice(0, KEEP_FIRST);
    var recent = state.conversationHistory.slice(-(MAX_HISTORY - KEEP_FIRST));
    state.conversationHistory = first.concat(recent);
  }
}

export function saveHistory(scope) {
  if (window.ALMA_DEMO) return;

  var hKey = scopedHistoryKey(historyKey(state.personName), scope || state.conversationScope);
  try {
    persistLocalHistory(historyStorageKey(hKey), state.conversationHistory);
  } catch (e) {
    state.conversationHistory = state.conversationHistory.slice(-10);
    persistLocalHistory(historyStorageKey(hKey), state.conversationHistory);
  }
  saveHistoryToDB(hKey, state.conversationHistory, scope || state.conversationScope);
}

export function loadHistoryFromDB(person, scope) {
  if (isDemo) return Promise.resolve([]);
  return fetch('/.netlify/functions/memories?action=get_history&person=' + encodeURIComponent(person) + '&scope=' + encodeURIComponent(scope || 'user'), { headers: authHeaders() })
    .then(function(r) { return r.json(); })
    .then(function(data) { return data.history || []; });
}

function saveHistoryToDB(person, messages, scope) {
  if (isDemo) return;
  if (_saveHistoryTimer) clearTimeout(_saveHistoryTimer);
  _saveHistoryTimer = setTimeout(function() {
    fetch('/.netlify/functions/memories', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action: 'save_history', person: person, scope: scope || 'user', messages: messages })
    }).catch(function() {});
  }, 2000);
}
