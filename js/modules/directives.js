/* ALMA v4 — Directives Panel Module */

import { state, currentDirectiveEntries } from './state.js';
import { authHeaders } from './api.js';
import { tt } from './ui.js';

export function setupDirectivesPanel() {
  var panel = document.getElementById('directivesPanel');
  var overlay = document.getElementById('directivesPanelOverlay');
  var openBtn = document.getElementById('btnDirectives');
  var closeBtn = document.getElementById('directivesPanelClose');

  if (!panel || !openBtn) return;

  var nameEl = document.getElementById('directivesPersonName');
  if (nameEl) nameEl.textContent = state.personName;

  function openPanel() {
    panel.classList.add('open');
    overlay.classList.add('open');
    loadDirectivesList();
  }

  function closePanel() {
    panel.classList.remove('open');
    overlay.classList.remove('open');
  }

  openBtn.addEventListener('click', openPanel);
  closeBtn.addEventListener('click', closePanel);
  overlay.addEventListener('click', closePanel);

  function loadDirectivesList() {
    var listEl = document.getElementById('chatDirectivesList');
    if (!listEl) return;
    listEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.78rem;">' + tt('directives.loading', null, 'Carregando...') + '</div>';
    currentDirectiveEntries.length = 0;

    fetch('/.netlify/functions/memories?action=list_directives&person=' + encodeURIComponent(state.personName), { headers: authHeaders() })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.directives || data.directives.length === 0) {
          listEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.78rem;text-align:center;padding:12px 0;">' + tt('directives.empty', null, 'Nenhuma diretriz ainda.') + '</div>';
          return;
        }
        listEl.textContent = '';
        data.directives.forEach(function(dir) {
          currentDirectiveEntries.push(dir);
          var isGlobal = !dir.person;
          var tagColor = isGlobal ? '#E8C547' : '#4A90D9';
          var tagLabel = isGlobal ? 'Global' : (dir.person || '');
          var safeId = parseInt(dir.id, 10);

          var row = document.createElement('div');
          row.style.background = 'var(--bg)';
          row.style.borderRadius = '8px';
          row.style.padding = '10px 12px';
          row.style.borderLeft = '2px solid ' + tagColor;
          row.style.display = 'flex';
          row.style.alignItems = 'flex-start';
          row.style.gap = '8px';

          var left = document.createElement('div');
          left.style.flex = '1';

          var label = document.createElement('span');
          label.style.fontSize = '0.62rem';
          label.style.color = tagColor;
          label.style.fontWeight = '600';
          label.textContent = tagLabel;

          var text = document.createElement('div');
          text.style.fontSize = '0.82rem';
          text.style.color = 'var(--text)';
          text.style.lineHeight = '1.4';
          text.style.marginTop = '2px';
          text.textContent = dir.directive_text || '';

          var del = document.createElement('button');
          del.type = 'button';
          del.style.background = 'none';
          del.style.border = 'none';
          del.style.color = 'var(--text-muted)';
          del.style.cursor = 'pointer';
          del.style.fontSize = '0.9rem';
          del.style.padding = '0 2px';
          del.style.lineHeight = '1';
          del.title = tt('directives.removeConfirm', null, 'Remover');
          del.textContent = '\u00d7';
          del.addEventListener('click', function() {
            deleteDirective(safeId);
          });

          left.appendChild(label);
          left.appendChild(text);
          row.appendChild(left);
          row.appendChild(del);
          listEl.appendChild(row);
        });
      })
      .catch(function() {
        listEl.innerHTML = '<div style="color:#f87171;font-size:0.78rem;">' + tt('directives.loadError', null, 'Erro ao carregar') + '</div>';
      });
  }

  function deleteDirective(id) {
    if (!confirm(tt('directives.removeConfirm', null, 'Remover esta diretriz?'))) return;
    fetch('/.netlify/functions/memories', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action: 'delete_directive', id: id })
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.success) loadDirectivesList();
    });
  }

  var addBtn = document.getElementById('chatAddDirBtn');
  if (addBtn) {
    addBtn.addEventListener('click', function() {
      var input = document.getElementById('chatNewDirText');
      var text = input.value.trim();
      if (!text) return;

      addBtn.disabled = true;
      fetch('/.netlify/functions/memories', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          action: 'add_directive',
          person: state.personName,
          directive_text: text,
          source: 'chat'
        })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.success) {
          input.value = '';
          loadDirectivesList();
        }
      }).finally(function() { addBtn.disabled = false; });
    });
  }
}
