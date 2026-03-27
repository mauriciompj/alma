/* ALMA v4 — Shared State Module */

export const MAX_HISTORY = 20;
export const KEEP_FIRST = 5;
export const MAX_CHARS = 500;

export const CORRECTION_ICON_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

export const state = {
  conversationHistory: [],
  isLoading: false,
  personName: '',
  personType: '',
  lastQuestion: '',
  personPhoto: '',
  almaPhoto: '',
  authorLabel: 'ALMA',
  voiceEnabled: localStorage.getItem('alma_voice_enabled') === '1',
  voiceAvailable: false,
  currentAudio: null,
  currentAudioButton: null,
  voiceNoticeShown: false,
};

export const voiceCache = new Map();
export const currentDirectiveEntries = [];
