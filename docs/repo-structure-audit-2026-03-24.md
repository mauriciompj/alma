# ALMA — Auditoria Completa do Projeto
## 24 de marco de 2026

---

## RESUMO EXECUTIVO

O ALMA e um projeto funcional, bem arquitetado e com proposito claro. Tem 1.077 chunks, 76 documentos, 14 categorias, 7 diretivas, 10 correcoes e 7 herdeiros configurados. A stack (vanilla frontend + Netlify serverless + Neon PostgreSQL + Claude AI) e adequada ao escopo.

Esta auditoria identificou **42 pontos de atencao** organizados por prioridade.

---

## CRITICO — Corrigir imediatamente

### 1. GETs publicos expondo dados pessoais
**Arquivo:** `memories.mjs` (linhas 164-410)
**Problema:** Todos os endpoints GET sao publicos. Qualquer pessoa com a URL pode:
- Ler historico de conversa: `GET /api/memories?action=get_history&person=Ana`
- Ver lista de usuarios: `GET /api/memories?action=get_persons`
- Ler qualquer config: `GET /api/memories?action=get_config&key=system_prompt_base`
- Buscar chunks por texto: `GET /api/memories?action=search&q=suicidio`
- Navegar todos os chunks: `GET /api/memories?action=admin_chunks`
**Fix:** Adicionar verificacao de sessao nos GETs sensiveis (admin_chunks, admin_corrections, get_config, get_history).

### 2. XSS em revisor.html (innerHTML com conteudo do usuario)
**Arquivo:** `revisor.html` (linha 213)
**Problema:** `content` e inserido via innerHTML em string concatenada. Embora exista `escapeHtml()`, o contexto de construcao da string pode permitir bypass.
**Fix:** Usar `textContent` em vez de innerHTML para conteudo do usuario.

### 3. 744 chunks orfaos (69%) sem document_id
**Problema:** `ingest.mjs` insere chunks sem `document_id`. O registro em `alma_documents` e feito separadamente, sem vincular os IDs.
**Impacto:** Impossivel rastrear qual documento gerou qual chunk.
**Fix:** Inserir `alma_documents` primeiro, capturar o ID retornado, e usar no INSERT dos chunks.

### 4. Sessao nao verificada no ingest
**Arquivo:** `ingest.mjs` (linhas 141-148)
**Problema:** Verifica se sessao existe e se e admin, mas NAO verifica se expirou (`expiresAt`).
**Fix:** Adicionar `if (new Date(session.expiresAt) < new Date()) return null;`

---

## ALTO — Corrigir em breve

### 5. Modelo de moderacao desatualizado
**Arquivo:** `memories.mjs` (linha 8)
**Problema:** Usa `claude-haiku-3-5-20241022` (modelo antigo).
**Fix:** Atualizar para `claude-haiku-4-5-20251001`.

### 6. Modelo do chat — avaliar atualizacao
**Arquivo:** `chat.mjs` (linha 9)
**Atual:** `claude-sonnet-4-20250514`
**Sugestao:** Avaliar `claude-sonnet-4-6` para respostas melhores.

### 7. 6 conexoes DB por request no chat
**Arquivo:** `chat.mjs` (linhas 229-521)
**Problema:** Cada funcao (searchMemories, getCorrections, getSystemPromptBase, getPersonContexts, getToneConfig, getDirectives) cria sua propria conexao `neon()`.
**Fix:** Criar conexao uma vez e passar como parametro.

### 8. CSP com 'unsafe-inline'
**Arquivo:** `netlify.toml` (linha 47)
**Problema:** `script-src 'self' 'unsafe-inline'` permite que qualquer script inline execute.
**Fix:** Remover `'unsafe-inline'`, mover scripts inline para arquivos .js externos, ou usar nonce-based CSP.

### 9. Backup nao inclui alma_legacy
**Arquivo:** `db/backup.mjs`
**Problema:** Faz backup de chunks, corrections, directives, config, documents. Mas NAO faz backup da tabela `alma_legacy` (heranca digital).
**Fix:** Adicionar `alma_legacy` ao backup.

### 10. package-lock.json no .gitignore
**Arquivo:** `.gitignore` (linha 2)
**Problema:** Sem lock file, installs podem gerar versoes diferentes das dependencias.
**Fix:** Remover `package-lock.json` do .gitignore e commitar o arquivo.

### 11. Indices faltando no banco
**Problema:** Queries frequentes sem indice:
- `alma_corrections.filho_nome` — usado em toda query de chat
- `alma_directives.person` — usado em toda query de chat
- `alma_documents.category` — usado em buscas
**Fix:**
```sql
CREATE INDEX idx_corrections_filho ON alma_corrections(filho_nome);
CREATE INDEX idx_directives_person ON alma_directives(person);
CREATE INDEX idx_documents_category ON alma_documents(category);
```

### 12. Sem endpoint de logout
**Problema:** O token de sessao (7 dias) nao pode ser invalidado pelo usuario.
**Fix:** Adicionar action `logout` no `auth.mjs` que deleta o token do banco.

---

## MEDIO — Melhorar quando possivel

### 13. Rate limiting in-memory (reseta no cold start)
**Arquivos:** `auth.mjs`, `chat.mjs`, `legacy.mjs`
**Problema:** Rate limit usa Map em memoria. No serverless, cada cold start zera o contador.
**Mitigacao:** Aceitavel para o escopo atual. Para escalar, usar Redis ou rate limit no Netlify.

### 14. Full-text search hardcoded para portugues
**Arquivo:** `db/seed.sql` (linha 68)
**Problema:** Trigger de search_vector usa `'portuguese'`. Conteudo em ingles/espanhol nao e buscavel via FTS.
**Fix futuro:** Armazenar idioma no chunk e usar no trigger.

### 15. handleImportChunks faz INSERT em loop
**Arquivo:** `memories.mjs` (linha 811)
**Problema:** Insere chunk por chunk (ate 500 queries sequenciais).
**Fix:** Batch insert ou transaction.

### 16. Sem ON DELETE CASCADE no document_id
**Arquivo:** `db/seed.sql`
**Problema:** Se deletar um documento, os chunks orfaos permanecem.
**Fix:** `ALTER TABLE alma_chunks ADD CONSTRAINT ... ON DELETE CASCADE;`

### 17. alma_conversations vazia
**Problema:** Tabela existe com 0 registros. Historico esta na alma_config como `history_Ana`.
**Sugestao:** Migrar para alma_conversations ou remover tabela nao usada.

### 18. Chunk de teste no banco
**Chunk 1372:** "TESTE TERMUX — pode apagar" (26 chars).
**Fix:** Deletar.

### 19. Credenciais demo hardcoded no frontend
**Arquivo:** `login.html` (linha 79)
**Problema:** `password: 'demo123'` visivel no codigo-fonte.
**Mitigacao:** Aceitavel para demo, mas mover para config do servidor seria melhor.

### 20. Termux scripts com shebang nao portavel
**Todos os tools:** `#!/data/data/com.termux/files/usr/bin/bash`
**Problema:** Funciona so no Termux.
**Fix:** Manter assim (scripts sao especificos para Termux). Documentar.

### 21. alma-record com path absoluto
**Arquivo:** `tools/alma-record` (linha 45)
**Problema:** Hardcoded `/data/data/com.termux/files/home/...`
**Fix:** Usar `$HOME/` em vez de path absoluto.

### 22. editChunk bugado no admin
**Arquivo:** `admin.html` (linhas 356-388)
**Problema:** Funcao faz fetch desnecessario (dummy) e pode nao encontrar o chunk se nao estiver na pagina atual.
**Fix:** Adicionar endpoint GET chunk por ID, ou buscar do DOM corretamente.

---

## BAIXO — Melhorias futuras

### 23-42. Lista consolidada

| # | Item | Arquivo |
|---|------|---------|
| 23 | Acessibilidade: divs com role="button" em vez de <button> | index.html |
| 24 | Falta i18n em revisor.html (strings hardcoded em PT) | revisor.html |
| 25 | Falta i18n em legacy.html | legacy.html |
| 26 | setup.html so em ingles, sem i18n | setup.html |
| 27 | Sem retry/backoff nos scripts Termux | tools/* |
| 28 | Sem validacao de tamanho de arquivo antes do upload | alma-send |
| 29 | Sem backup automatico (cron) | db/backup.mjs |
| 30 | Sem retencao de backups antigos | db/backup.mjs |
| 31 | Sem verificacao de integridade do backup | db/backup.mjs |
| 32 | Token duplicado entre auth.mjs e legacy.mjs | auth.mjs, legacy.mjs |
| 33 | Source file sem UUID pode colidir | ingest.mjs |
| 34 | Sem unique constraint nos chunks | seed.sql |
| 35 | handleMigrateDirectives e one-time, pode ser removida | memories.mjs |
| 36 | Sem focus-visible styling no CSS | style.css |
| 37 | Dead code: fetch dummy no editChunk | admin.html |
| 38 | Sobre.html com onclick inline | sobre.html |
| 39 | Sem catch-all 404 redirect no netlify.toml | netlify.toml |
| 40 | Sem staging environment | deploy |
| 41 | Sem audit logging de operacoes | geral |
| 42 | Cache de system prompt/tone config por TTL | chat.mjs |

---

## O QUE FUNCIONA BEM

- **Arquitetura limpa:** vanilla frontend sem framework, serverless backend, PostgreSQL
- **RAG funcional:** busca full-text + reranking por pessoa + correcoes + diretivas
- **Seguranca solida:** bcrypt(12), CORS restrito, CSP, HSTS, rate limiting, moderacao de conteudo
- **Sistema de correcoes:** human-in-the-loop com classificacao por IA
- **Adaptacao por idade:** calcula idade real e ajusta vocabulario/profundidade
- **Mobile capture completo:** alma-send, alma-quick, alma-voice, alma-record, share intents
- **Legacy mode:** heranca digital com frases-chave bcrypt e niveis de acesso
- **i18n funcional:** 3 idiomas com fallback
- **PWA instalavel:** service worker, offline-capable
- **Voz clonada:** ElevenLabs TTS integrado
- **Documentacao forte:** READMEs em PT e EN, CONTRIBUTING.md, DEMO_SETUP.md
- **Testes:** suite de 38 pontos (deep-test.mjs)

---

## PROXIMOS PASSOS RECOMENDADOS

### Sprint 1 — Seguranca (critico)
1. Auth nos GETs sensiveis
2. Fix expiracao de sessao no ingest
3. Fix XSS no revisor.html

### Sprint 2 — Performance e dados
4. Conexao DB unica por request
5. Indices faltando
6. Fix document_id no ingest
7. Atualizar modelos de IA

### Sprint 3 — Qualidade
8. Backup incluir alma_legacy
9. Commitar package-lock.json
10. Endpoint de logout
11. Limpar chunk de teste
