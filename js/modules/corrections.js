/* ALMA v4 — Correction & Directive Classification Module */

import { state, CORRECTION_ICON_SVG } from './state.js';
import { authHeaders } from './api.js';
import { tt, showSuccess, showError, createIconFragment, escapeHtmlSafe, setStatusBlock } from './ui.js';

var correctionOriginalText = '';
var correctionQuestion = '';
var classificationResult = null;

export function createCorrectionModal() {
  var overlay = document.createElement('div');
  overlay.id = 'correctionOverlay';
  overlay.className = 'correction-overlay';
  var modal = document.createElement('div');
  modal.className = 'correction-modal';
  var header = document.createElement('div');
  header.className = 'correction-header';
  var title = document.createElement('h3');
  title.textContent = tt('correction.title', null, 'Corrigir / Nova diretriz');
  var close = document.createElement('button');
  close.className = 'correction-close';
  close.id = 'correctionClose';
  close.type = 'button';
  close.textContent = '\u00d7';
  header.appendChild(title);
  header.appendChild(close);

  var body = document.createElement('div');
  body.className = 'correction-body';
  var originalWrap = document.createElement('div');
  originalWrap.className = 'correction-original';
  var originalLabel = document.createElement('label');
  originalLabel.textContent = tt('correction.originalLabel', null, 'Resposta original:');
  var originalTextEl = document.createElement('div');
  originalTextEl.className = 'correction-original-text';
  originalTextEl.id = 'correctionOriginal';
  originalWrap.appendChild(originalLabel);
  originalWrap.appendChild(originalTextEl);

  var inputGroup = document.createElement('div');
  inputGroup.className = 'correction-input-group';
  var inputLabel = document.createElement('label');
  inputLabel.htmlFor = 'correctionText';
  inputLabel.textContent = tt('correction.inputLabel', null, 'O que está errado? Ou que diretriz quer adicionar?');
  var textarea = document.createElement('textarea');
  textarea.id = 'correctionText';
  textarea.className = 'correction-textarea';
  textarea.rows = 3;
  textarea.maxLength = 2000;
  textarea.placeholder = tt('correction.inputPlaceholder', null, 'Ex: Essa resposta ficou fria demais, fale com mais calor...');
  var charCountEl = document.createElement('span');
  charCountEl.className = 'correction-char-count';
  charCountEl.id = 'correctionCharCount';
  charCountEl.textContent = '0/2000';
  inputGroup.appendChild(inputLabel);
  inputGroup.appendChild(textarea);
  inputGroup.appendChild(charCountEl);

  var classifyResult = document.createElement('div');
  classifyResult.id = 'classifyResult';
  classifyResult.style.display = 'none';
  classifyResult.style.marginTop = '14px';

  body.appendChild(originalWrap);
  body.appendChild(inputGroup);
  body.appendChild(classifyResult);

  var footer = document.createElement('div');
  footer.className = 'correction-footer';
  var cancel = document.createElement('button');
  cancel.className = 'correction-btn-cancel';
  cancel.id = 'correctionCancel';
  cancel.type = 'button';
  cancel.textContent = tt('correction.cancelButton', null, 'Cancelar');
  var analyze = document.createElement('button');
  analyze.className = 'correction-btn-save';
  analyze.id = 'correctionAnalyze';
  analyze.type = 'button';
  analyze.style.background = 'var(--blue)';
  analyze.style.border = 'none';
  analyze.style.borderRadius = '8px';
  analyze.style.color = 'white';
  analyze.style.padding = '10px 20px';
  analyze.style.fontSize = '0.88rem';
  analyze.style.fontWeight = '600';
  analyze.style.cursor = 'pointer';
  analyze.style.fontFamily = 'inherit';
  analyze.textContent = tt('correction.analyzeButton', null, 'Analisar');
  var save = document.createElement('button');
  save.className = 'correction-btn-save';
  save.id = 'correctionSave';
  save.type = 'button';
  save.style.display = 'none';
  save.textContent = tt('correction.saveButton', null, 'Salvar');
  footer.appendChild(cancel);
  footer.appendChild(analyze);
  footer.appendChild(save);

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);

  document.body.appendChild(overlay);

  document.getElementById('correctionClose').addEventListener('click', closeCorrectionModal);
  document.getElementById('correctionCancel').addEventListener('click', closeCorrectionModal);
  document.getElementById('correctionAnalyze').addEventListener('click', classifyInput);
  document.getElementById('correctionSave').addEventListener('click', saveFinalResult);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeCorrectionModal();
  });

  textarea.addEventListener('input', function () {
    charCountEl.textContent = textarea.value.length + '/2000';
  });
}

export function openCorrectionModal(originalText, question) {
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

  var displayText = originalText.length > 300
    ? originalText.substring(0, 300) + '...'
    : originalText;
  originalEl.textContent = displayText;

  textarea.value = '';
  charCountEl.textContent = '0/2000';
  classifyEl.style.display = 'none';
  classifyEl.textContent = '';
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
  setStatusBlock(classifyEl, tt('correction.analyzingAI', null, 'Analisando com IA...'), 'var(--text-muted)');

  try {
    var response = await fetch('/.netlify/functions/memories', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        action: 'classify_input',
        text: text,
        originalQuestion: correctionQuestion,
        originalResponse: correctionOriginalText,
        personName: state.personName,
      }),
    });

    var result = await response.json();

    if (result.success && result.classification) {
      classificationResult = result.classification;
      renderClassification(result.classification, text);
    } else {
      setStatusBlock(classifyEl, tt('correction.classifyFailed', null, 'Não consegui classificar. Escolha manualmente:'), '#f87171');
      renderManualChoice(text);
    }
  } catch (err) {
    setStatusBlock(classifyEl, tt('correction.networkError', null, 'Erro de rede. Escolha manualmente:'), '#f87171');
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

  classifyEl.textContent = '';
  var card = document.createElement('div');
  card.style.background = 'var(--bg)';
  card.style.borderRadius = '10px';
  card.style.padding = '14px';
  card.style.borderLeft = '3px solid ' + typeColor;
  var header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.gap = '8px';
  header.style.marginBottom = '8px';
  var badge = document.createElement('span');
  badge.style.fontSize = '0.75rem';
  badge.style.background = typeColor + '22';
  badge.style.color = typeColor;
  badge.style.padding = '2px 10px';
  badge.style.borderRadius = '4px';
  badge.style.fontWeight = '600';
  badge.textContent = typeLabel;
  header.appendChild(badge);
  if (cls.person) {
    var person = document.createElement('span');
    person.style.fontSize = '0.72rem';
    person.style.color = 'var(--text-muted)';
    person.textContent = 'para ' + cls.person;
    header.appendChild(person);
  }
  var refined = document.createElement('div');
  refined.style.fontSize = '0.85rem';
  refined.style.color = 'var(--text)';
  refined.style.lineHeight = '1.5';
  refined.style.marginBottom = '8px';
  var refinedStrong = document.createElement('strong');
  refinedStrong.textContent = tt('correction.refinedText', null, 'Texto refinado:');
  refined.appendChild(refinedStrong);
  refined.appendChild(document.createTextNode(' ' + (cls.refined_text || originalText)));
  var explanation = document.createElement('div');
  explanation.style.fontSize = '0.78rem';
  explanation.style.color = 'var(--text-soft)';
  explanation.style.fontStyle = 'italic';
  explanation.textContent = cls.explanation || '';
  var actions = document.createElement('div');
  actions.style.marginTop = '10px';
  actions.style.display = 'flex';
  actions.style.gap = '6px';
  actions.style.flexWrap = 'wrap';
  [
    { type: 'correction', color: '#D94A4A', label: typeLabels.correction },
    { type: 'directive_individual', color: '#4A90D9', label: typeLabels.directive_individual + ' ' + personLabel },
    { type: 'directive_global', color: '#E8C547', label: typeLabels.directive_global }
  ].forEach(function(item) {
    var btn = document.createElement('button');
    btn.className = 'corr-type-btn';
    btn.dataset.type = item.type;
    btn.type = 'button';
    btn.style.fontSize = '0.72rem';
    btn.style.padding = '4px 10px';
    btn.style.borderRadius = '5px';
    btn.style.border = '1px solid ' + item.color + '33';
    btn.style.background = item.color + '15';
    btn.style.color = item.color;
    btn.style.cursor = 'pointer';
    btn.style.fontFamily = 'inherit';
    if (cls.type === item.type) {
      btn.style.borderColor = item.color;
      btn.style.fontWeight = '700';
    }
    btn.textContent = item.label;
    actions.appendChild(btn);
  });
  card.appendChild(header);
  card.appendChild(refined);
  card.appendChild(explanation);
  card.appendChild(actions);
  classifyEl.appendChild(card);

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
  classificationResult = { type: 'correction', person: state.personName, refined_text: text, explanation: '' };
  renderClassification(classificationResult, text);
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
      var response = await fetch('/.netlify/functions/memories', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          action: 'save_correction',
          originalQuestion: correctionQuestion,
          originalResponse: correctionOriginalText,
          correction: finalText,
          personName: state.personName,
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
      var person = cls.type === 'directive_global' ? '_global' : (cls.person || state.personName);
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
