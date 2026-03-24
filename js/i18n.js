/**
 * ALMA i18n — Lightweight internationalization
 * Loads locale JSON files and provides t() function for translations
 */
(function() {
  'use strict';

  var SUPPORTED = ['pt-BR', 'en', 'es'];
  var DEFAULT_LANG = 'pt-BR';
  var currentLocale = {};
  var currentLang = DEFAULT_LANG;

  // Detect language: localStorage > browser > default
  function detectLang() {
    var saved = localStorage.getItem('alma_lang');
    if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;

    var browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (browserLang.startsWith('es')) return 'es';
    if (browserLang.startsWith('en')) return 'en';
    return DEFAULT_LANG;
  }

  // Get nested value from object by dot-separated key
  function getNestedValue(obj, key) {
    var parts = key.split('.');
    var current = obj;
    for (var i = 0; i < parts.length; i++) {
      if (current === undefined || current === null) return null;
      current = current[parts[i]];
    }
    return current;
  }

  // Translate function: t('login.submitButton') → 'Entrar' or 'Sign In'
  window.t = function(key, replacements) {
    var value = getNestedValue(currentLocale, key);
    if (value === null || value === undefined) return key; // Fallback to key

    if (typeof value !== 'string') return key;

    // Replace {placeholder} patterns
    if (replacements) {
      Object.keys(replacements).forEach(function(k) {
        value = value.replace(new RegExp('\\{' + k + '\\}', 'g'), replacements[k]);
      });
    }
    return value;
  };

  // Load locale and apply
  window.loadLocale = function(lang, callback) {
    if (SUPPORTED.indexOf(lang) === -1) lang = DEFAULT_LANG;
    currentLang = lang;
    localStorage.setItem('alma_lang', lang);

    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/locales/' + lang + '.json', true);
    xhr.onload = function() {
      if (xhr.status === 200) {
        try {
          currentLocale = JSON.parse(xhr.responseText);
        } catch (e) {
          currentLocale = {};
        }
      }
      if (callback) callback(currentLang);
    };
    xhr.onerror = function() {
      if (callback) callback(currentLang);
    };
    xhr.send();
  };

  // Get current language
  window.getCurrentLang = function() { return currentLang; };

  // Create language selector widget
  window.createLangSelector = function(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var flags = { 'pt-BR': '🇧🇷', 'en': '🇺🇸', 'es': '🇪🇸' };
    var labels = { 'pt-BR': 'PT', 'en': 'EN', 'es': 'ES' };
    container.textContent = '';

    var wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.gap = '6px';
    wrapper.style.justifyContent = 'center';
    wrapper.style.alignItems = 'center';

    SUPPORTED.forEach(function(lang) {
      var isActive = lang === currentLang;
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = flags[lang] + ' ' + labels[lang];
      button.style.background = isActive ? 'rgba(216,170,50,0.2)' : 'transparent';
      button.style.border = '1px solid ' + (isActive ? 'rgba(216,170,50,0.5)' : 'rgba(255,255,255,0.15)');
      button.style.color = isActive ? '#d8aa32' : 'rgba(255,255,255,0.5)';
      button.style.borderRadius = '6px';
      button.style.padding = '4px 10px';
      button.style.cursor = 'pointer';
      button.style.fontSize = '12px';
      button.style.fontWeight = isActive ? '700' : '400';
      button.style.fontFamily = 'inherit';
      button.style.transition = 'all 0.2s';
      button.addEventListener('click', function() {
        switchLang(lang);
      });
      wrapper.appendChild(button);
    });

    container.appendChild(wrapper);
  };

  // Switch language and reload page
  window.switchLang = function(lang) {
    localStorage.setItem('alma_lang', lang);
    location.reload();
  };

  // Auto-detect on load
  currentLang = detectLang();
})();
