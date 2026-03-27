/* ALMA v4 — Voice System Module (ElevenLabs TTS) */

import { state, voiceCache } from './state.js';
import { authHeaders } from './api.js';
import { tt, showSuccess, showError } from './ui.js';

export function setupVoiceToggle() {
  var btn = document.getElementById('btnVoiceToggle');
  if (!btn) return;

  fetch('/.netlify/functions/alma-voice', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ text: '' }),
  }).then(function(r) {
    if (r.status === 503) {
      state.voiceAvailable = false;
      state.voiceEnabled = false;
      btn.style.display = 'none';
      document.querySelectorAll('.btn-play-voice').forEach(function(b) { b.style.display = 'none'; });
    } else {
      state.voiceAvailable = true;
      updateVoiceToggleUI();
      // Retroactively add voice buttons to already-rendered ALMA messages
      document.querySelectorAll('.message.alma .message-content').forEach(function(content) {
        if (content.querySelector('.btn-play-voice')) return;
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
        var corrBtn = content.querySelector('.btn-correct');
        if (corrBtn) {
          content.insertBefore(voiceBtn, corrBtn);
        } else {
          content.appendChild(voiceBtn);
        }
      });
    }
  }).catch(function() {
    state.voiceAvailable = false;
    btn.style.display = 'none';
  });

  btn.addEventListener('click', function () {
    if (!state.voiceAvailable) return;
    state.voiceEnabled = !state.voiceEnabled;
    localStorage.setItem('alma_voice_enabled', state.voiceEnabled ? '1' : '0');
    updateVoiceToggleUI();
    if (!state.voiceEnabled) stopCurrentAudio();
    showSuccess(state.voiceEnabled
      ? tt('voice.autoEnabled', null, 'Voz automática ativada.')
      : tt('voice.autoDisabled', null, 'Voz automática desativada.'));
  });
}

export function updateVoiceToggleUI() {
  var btn = document.getElementById('btnVoiceToggle');
  if (!btn) return;
  btn.classList.toggle('active', state.voiceEnabled);
  btn.setAttribute('aria-pressed', state.voiceEnabled ? 'true' : 'false');
  var title = state.voiceEnabled
    ? tt('voice.autoOnTitle', null, 'Voz automática ativada')
    : tt('voice.autoOffTitle', null, 'Ativar voz automática');
  btn.title = title;
  btn.setAttribute('aria-label', title);
}

export async function playVoiceForButton(btn, text, options) {
  var opts = options || {};

  if (!opts.forcePlay && state.currentAudio && state.currentAudioButton === btn) {
    stopCurrentAudio();
    return;
  }

  updateVoiceButtonState(btn, 'loading');

  try {
    var audioUrl = await requestVoiceAudio(text);
    await startVoicePlayback(audioUrl, btn);
  } catch (err) {
    console.error('Voice playback failed:', err);
    if (btn && (!state.currentAudioButton || state.currentAudioButton !== btn)) {
      updateVoiceButtonState(btn, 'idle');
    }
    if (err && err.code === 'VOICE_NOT_CONFIGURED' && state.voiceEnabled) {
      state.voiceEnabled = false;
      localStorage.setItem('alma_voice_enabled', '0');
      updateVoiceToggleUI();
    }
    if (!(opts.fromAuto && err && err.name === 'NotAllowedError')) {
      showError(err.message || tt('voice.requestError', null, 'Não consegui gerar a voz agora.'));
    } else if (!state.voiceNoticeShown) {
      state.voiceNoticeShown = true;
      showError(tt('voice.autoplayBlocked', null, 'O navegador bloqueou a reprodução automática. Toque em Ouvir.'));
    }
    throw err;
  }
}

export function updateVoiceButtonState(btn, voiceState) {
  if (!btn) return;
  btn.classList.remove('is-loading', 'is-playing');
  if (voiceState === 'loading') {
    btn.classList.add('is-loading');
    btn.disabled = true;
    btn.textContent = tt('voice.loading', null, 'Gerando voz...');
  } else if (voiceState === 'playing') {
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
  if (voiceCache.size >= 50) {
    var oldest = voiceCache.keys().next().value;
    voiceCache.delete(oldest);
  }
  voiceCache.set(cleanText, audioUrl);
  return audioUrl;
}

async function startVoicePlayback(audioUrl, btn) {
  stopCurrentAudio();
  state.currentAudio = new Audio(audioUrl);
  state.currentAudioButton = btn;

  state.currentAudio.addEventListener('ended', function () {
    if (state.currentAudioButton === btn) {
      updateVoiceButtonState(btn, 'idle');
      state.currentAudio = null;
      state.currentAudioButton = null;
    }
  });

  state.currentAudio.addEventListener('error', function () {
    if (state.currentAudioButton === btn) {
      updateVoiceButtonState(btn, 'idle');
      state.currentAudio = null;
      state.currentAudioButton = null;
    }
  });

  updateVoiceButtonState(btn, 'playing');
  await state.currentAudio.play();
}

export function stopCurrentAudio() {
  if (state.currentAudio) {
    state.currentAudio.pause();
    state.currentAudio.currentTime = 0;
  }
  if (state.currentAudioButton) {
    updateVoiceButtonState(state.currentAudioButton, 'idle');
  }
  state.currentAudio = null;
  state.currentAudioButton = null;
}
