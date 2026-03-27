/* ALMA v4 — API / Backend Communication Module */

import { state } from './state.js';
import { currentLang } from './ui.js';

export function authHeaders() {
  var token = localStorage.getItem('alma_token') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
  };
}

export async function sendToBackend(userMessage) {
  var response = await fetch('/.netlify/functions/chat', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      message: userMessage,
      personName: state.personName,
      lang: currentLang(),
      birthDate: localStorage.getItem('alma_birthDate') || null,
      history: state.conversationHistory.filter(function (m) {
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
