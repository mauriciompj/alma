/* ALMA v4 — History Persistence Module */

import { state, MAX_HISTORY, KEEP_FIRST } from './state.js';
import { authHeaders } from './api.js';
import { historyKey } from './ui.js';

var isDemo = location.hostname.includes('demo');
var _saveHistoryTimer = null;

export function truncateHistory() {
  if (state.conversationHistory.length > MAX_HISTORY) {
    var first = state.conversationHistory.slice(0, KEEP_FIRST);
    var recent = state.conversationHistory.slice(-(MAX_HISTORY - KEEP_FIRST));
    state.conversationHistory = first.concat(recent);
  }
}

export function saveHistory() {
  if (window.ALMA_DEMO) return;

  var hKey = historyKey(state.personName);
  try {
    sessionStorage.setItem('alma_history_' + hKey, JSON.stringify(state.conversationHistory));
  } catch (e) {
    state.conversationHistory = state.conversationHistory.slice(-10);
    sessionStorage.setItem('alma_history_' + hKey, JSON.stringify(state.conversationHistory));
  }
  saveHistoryToDB(hKey, state.conversationHistory);
}

export function loadHistoryFromDB(person) {
  if (isDemo) return Promise.resolve([]);
  return fetch('/.netlify/functions/memories?action=get_history&person=' + encodeURIComponent(person), { headers: authHeaders() })
    .then(function(r) { return r.json(); })
    .then(function(data) { return data.history || []; });
}

function saveHistoryToDB(person, messages) {
  if (isDemo) return;
  if (_saveHistoryTimer) clearTimeout(_saveHistoryTimer);
  _saveHistoryTimer = setTimeout(function() {
    fetch('/.netlify/functions/memories', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action: 'save_history', person: person, messages: messages })
    }).catch(function() {});
  }, 2000);
}
