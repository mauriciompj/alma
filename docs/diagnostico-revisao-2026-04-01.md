# Diagnóstico Profissional ALMA

Data: 2026-04-01

## Escopo revisado

- Aplicação principal em `alma/`
- Frontend estático HTML/CSS/JS
- Funções Netlify em `netlify/functions/`
- Esquema base em `db/seed.sql`
- Testes unitários e de integração existentes

## Resumo executivo

Foram encontrados dois problemas operacionais relevantes e um risco de segurança importante no frontend.

O problema mais grave era uma deriva entre schema e código: o runtime assumia a coluna `content_clean`, mas o schema base não a cria. Isso quebrava busca e chat em bases antigas ou recém-semeadas, gerando erro `500`.

Também há exposição de token de sessão no `localStorage`, o que mantém a aplicação funcional, mas amplia o impacto de qualquer XSS.

## Achados principais

### 1. Alta severidade — deriva de schema quebrando `search` e `chat`

**Evidência**

- [db/seed.sql](/C:/Users/PJC/OneDrive/9_PESSOAL/PROJETO%20ALMA/alma/db/seed.sql#L18) cria `alma_chunks` sem a coluna `content_clean`.
- [netlify/functions/chat.mjs](/C:/Users/PJC/OneDrive/9_PESSOAL/PROJETO%20ALMA/alma/netlify/functions/chat.mjs#L303) consultava `COALESCE(content_clean, content)`.
- [netlify/functions/memories.mjs](/C:/Users/PJC/OneDrive/9_PESSOAL/PROJETO%20ALMA/alma/netlify/functions/memories.mjs#L85) também dependia de `content_clean` em busca e listagem administrativa.

**Impacto**

- `chat` autenticado falhava com `500`.
- `memories?action=search&q=...` falhava com `500`.
- Bases legadas ou criadas pelo seed base não eram compatíveis com o código atual.

**Correção aplicada**

- Adicionado fallback compatível com schemas sem `content_clean` em:
  - [netlify/functions/chat.mjs](/C:/Users/PJC/OneDrive/9_PESSOAL/PROJETO%20ALMA/alma/netlify/functions/chat.mjs#L301)
  - [netlify/functions/memories.mjs](/C:/Users/PJC/OneDrive/9_PESSOAL/PROJETO%20ALMA/alma/netlify/functions/memories.mjs#L81)
- Padronizado o uso de `SEARCH_LANGUAGE` em vez de `portuguese` hardcoded em consultas administrativas e de busca:
  - [netlify/functions/memories.mjs](/C:/Users/PJC/OneDrive/9_PESSOAL/PROJETO%20ALMA/alma/netlify/functions/memories.mjs#L11)

### 2. Média severidade — token de sessão persistido em `localStorage`

**Evidência**

- [login.html](/C:/Users/PJC/OneDrive/9_PESSOAL/PROJETO%20ALMA/alma/login.html#L101) grava `alma_token` em `localStorage`.
- [login.html](/C:/Users/PJC/OneDrive/9_PESSOAL/PROJETO%20ALMA/alma/login.html#L149) repete a mesma estratégia no login padrão.

**Impacto**

- Qualquer XSS bem-sucedido consegue exfiltrar o token.
- A superfície aumenta porque o app usa bastante renderização dinâmica no frontend.

**Ação recomendada**

- Migrar sessão para cookie `HttpOnly` + `Secure` + `SameSite=Lax` ou `Strict`.
- Manter no frontend apenas estado não sensível.

### 3. Média severidade — construção de DOM com `innerHTML` em fluxo visual

**Evidência**

- O indicador de digitação antes era montado com `innerHTML`, misturando texto configurável e atributos inline.
- Ponto corrigido em [js/modules/ui.js](/C:/Users/PJC/OneDrive/9_PESSOAL/PROJETO%20ALMA/alma/js/modules/ui.js#L76).

**Impacto**

- Não era o maior risco atual, mas era um vetor desnecessário para XSS DOM-based caso `state.authorLabel` ou `state.almaPhoto` fossem contaminados.

**Correção aplicada**

- Substituição por criação explícita de nós DOM com `textContent` e `style` controlado.

## Validação executada

- `npm run test:unit`
  - Resultado: 70/70 passando
- Importação/sintaxe validada:
  - `node -e "import('./netlify/functions/chat.mjs')..."`
  - `node -e "import('./netlify/functions/memories.mjs')..."`
- `npm test`
  - Antes das correções, o suite apontou 2 falhas reais em integração demo:
    - `Chat with valid auth returns AI response`
    - `Search with query returns results`
  - Essas falhas são coerentes com a deriva de schema corrigida localmente, mas não podem ser revalidadas remotamente sem deploy da versão ajustada.

## Melhorias recomendadas

### Prioridade 1

- Criar migration formal para adicionar `content_clean` em vez de depender apenas de fallback.
- Mover autenticação para cookie `HttpOnly`.
- Executar um deploy de validação e repetir `npm test`.

### Prioridade 2

- Unificar lógica de RAG e auth compartilhando helpers entre `chat.mjs` e `lib/`, reduzindo deriva futura.
- Adicionar teste de compatibilidade com schema legado sem `content_clean`.
- Tornar `npm test` orientado a ambiente local/preview por padrão, em vez de depender da demo pública.

### Prioridade 3

- Revisar usos restantes de `innerHTML` em telas administrativas e páginas utilitárias.
- Adicionar CSP com nonce/hash para reduzir dependência de `'unsafe-inline'` a médio prazo.

## Arquivos alterados nesta revisão

- [netlify/functions/chat.mjs](/C:/Users/PJC/OneDrive/9_PESSOAL/PROJETO%20ALMA/alma/netlify/functions/chat.mjs)
- [netlify/functions/memories.mjs](/C:/Users/PJC/OneDrive/9_PESSOAL/PROJETO%20ALMA/alma/netlify/functions/memories.mjs)
- [js/modules/ui.js](/C:/Users/PJC/OneDrive/9_PESSOAL/PROJETO%20ALMA/alma/js/modules/ui.js)
