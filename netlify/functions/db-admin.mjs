/**
 * ALMA DB Admin — Natural language → SQL via Claude
 * Admin-only function that:
 * 1. Receives natural language instructions
 * 2. Uses Claude to generate safe SQL
 * 3. Returns SQL for approval (preview mode)
 * 4. Executes approved SQL (execute mode)
 * 5. Exports full DB backup (export mode)
 */

import { neon } from '@neondatabase/serverless';
import { verifySession, jsonResponse, corsResponse } from './lib/auth.mjs';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const SQL_MODEL = 'claude-sonnet-4-5-20250514';

const DB_SCHEMA = `
## ALMA Database Schema (PostgreSQL / Neon)

### alma_chunks (memórias / base de conhecimento)
- id: SERIAL PRIMARY KEY
- content: TEXT (conteúdo principal)
- title: VARCHAR(500)
- category: VARCHAR(100)
- tags: TEXT[] (array de tags)
- source_file: VARCHAR(255)
- chunk_index: INTEGER
- char_count: INTEGER
- search_vector: TSVECTOR (busca full-text, auto-gerado)
- created_at: TIMESTAMPTZ
- content_clean: TEXT
- document_id: INTEGER

### alma_corrections (correções de respostas)
- id: SERIAL PRIMARY KEY
- original_question: TEXT
- original_response: TEXT
- correction: TEXT
- filho_nome: VARCHAR(50)
- categories: TEXT[]
- active: BOOLEAN DEFAULT true
- created_at: TIMESTAMPTZ

### alma_config (chave-valor para configurações)
- key: VARCHAR(255) PRIMARY KEY
- value: TEXT
- updated_at: TIMESTAMPTZ
Chaves importantes: users_json, tone_global, system_prompt_base, person_context_<nome>, session_<token>, magic_<token>, photo_<nome>

### alma_directives (regras comportamentais)
- id: SERIAL PRIMARY KEY
- person: VARCHAR(50) (NULL = global)
- directive_text: TEXT
- active: BOOLEAN DEFAULT true
- source: VARCHAR(20) ('admin', 'chat', 'correction', 'migrated')
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ

### alma_documents (documentos importados)
- source_file: VARCHAR(255) UNIQUE
- title: VARCHAR(500)
- category: VARCHAR(100)
- total_chunks: INTEGER

### alma_conversations (histórico de conversas)
- id: SERIAL PRIMARY KEY
- person_name: VARCHAR(50)
- role: VARCHAR(10)
- content: TEXT
- created_at: TIMESTAMPTZ

### alma_legacy (legado emocional)
- id: SERIAL PRIMARY KEY
- person_name: VARCHAR(50)
- category: VARCHAR(100)
- content: TEXT
- created_at: TIMESTAMPTZ
`;

const SYSTEM_PROMPT = `Você é um assistente de banco de dados para o sistema ALMA (Arquivo de Legado emocional).
Sua função é converter instruções em português para comandos SQL PostgreSQL seguros.

${DB_SCHEMA}

## REGRAS OBRIGATÓRIAS:
1. NUNCA gere DROP TABLE, DROP DATABASE, TRUNCATE ou qualquer comando destrutivo em massa
2. NUNCA delete sessões (session_*) ou tokens de autenticação
3. Para DELETE ou UPDATE, SEMPRE inclua WHERE clause específica
4. Para UPDATE em alma_config, use INSERT ... ON CONFLICT (key) DO UPDATE para upsert
5. Prefira operações granulares (uma tabela por vez)
6. Retorne APENAS o SQL, sem explicações, sem markdown, sem backticks
7. Se a instrução for ambígua, gere um SELECT primeiro para mostrar o estado atual
8. Para consultas, use LIMIT 50 por padrão
9. Sempre atualize o campo updated_at quando disponível
10. Para alma_chunks, ao atualizar content, recalcule search_vector: search_vector = to_tsvector('simple', NEW_CONTENT)

## FORMATO DE RESPOSTA:
Retorne APENAS SQL válido. Múltiplos comandos separados por ponto-e-vírgula.
Se precisar explicar algo, use comentários SQL (-- comentário).`;

export default async function handler(req) {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const dbUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) return jsonResponse({ error: 'Database not configured' }, 500);

  const sql = neon(dbUrl);

  // Auth: admin only
  const session = await verifySession(sql, req);
  if (!session || !session.admin) {
    return jsonResponse({ error: 'Admin access required' }, 403);
  }

  const body = await req.json();
  const { action } = body;

  try {
    // === EXPORT: Full DB backup ===
    if (action === 'export') {
      const [chunks, corrections, config, directives, documents, conversations, legacy] = await Promise.all([
        sql`SELECT * FROM alma_chunks ORDER BY id`,
        sql`SELECT * FROM alma_corrections ORDER BY id`,
        sql`SELECT * FROM alma_config WHERE key NOT LIKE 'session_%' AND key NOT LIKE 'ratelimit_%' ORDER BY key`,
        sql`SELECT * FROM alma_directives ORDER BY id`,
        sql`SELECT * FROM alma_documents ORDER BY source_file`,
        sql`SELECT * FROM alma_conversations ORDER BY id`,
        sql`SELECT * FROM alma_legacy ORDER BY id`,
      ]);

      return jsonResponse({
        success: true,
        backup: {
          exported_at: new Date().toISOString(),
          alma_chunks: chunks,
          alma_corrections: corrections,
          alma_config: config,
          alma_directives: directives,
          alma_documents: documents,
          alma_conversations: conversations,
          alma_legacy: legacy,
        }
      });
    }

    // === PREVIEW: Generate SQL from natural language ===
    if (action === 'preview') {
      const { instruction } = body;
      if (!instruction || !instruction.trim()) {
        return jsonResponse({ error: 'Instrução vazia' }, 400);
      }

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return jsonResponse({ error: 'API key not configured' }, 500);

      const response = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: SQL_MODEL,
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: instruction }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('[DB Admin] Claude error:', err);
        return jsonResponse({ error: 'Falha ao gerar SQL' }, 502);
      }

      const data = await response.json();
      const generatedSql = data.content[0].text.trim();

      // Safety check: block destructive commands
      const upper = generatedSql.toUpperCase();
      const blocked = ['DROP TABLE', 'DROP DATABASE', 'TRUNCATE', 'DROP SCHEMA', 'ALTER TABLE.*DROP'];
      for (const pattern of blocked) {
        if (new RegExp(pattern).test(upper)) {
          return jsonResponse({
            error: 'SQL bloqueado: contém comando destrutivo (' + pattern + ')',
            sql: generatedSql,
          }, 400);
        }
      }

      // Classify: is it read-only or mutating?
      const isReadOnly = /^\s*(SELECT|WITH|EXPLAIN)/i.test(generatedSql) &&
                         !/INSERT|UPDATE|DELETE|CREATE|ALTER/i.test(generatedSql);

      return jsonResponse({
        success: true,
        sql: generatedSql,
        isReadOnly,
        warning: isReadOnly ? null : '⚠️ Este comando modifica dados. Recomendado exportar backup antes de executar.',
      });
    }

    // === EXECUTE: Run approved SQL ===
    if (action === 'execute') {
      const { sqlCommand } = body;
      if (!sqlCommand || !sqlCommand.trim()) {
        return jsonResponse({ error: 'SQL vazio' }, 400);
      }

      // Safety re-check
      const upper = sqlCommand.toUpperCase();
      const blocked = ['DROP TABLE', 'DROP DATABASE', 'TRUNCATE', 'DROP SCHEMA'];
      for (const pattern of blocked) {
        if (upper.includes(pattern)) {
          return jsonResponse({ error: 'SQL bloqueado: ' + pattern }, 400);
        }
      }

      // Split by semicolons and execute each statement
      const statements = sqlCommand
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      const results = [];
      for (const stmt of statements) {
        try {
          const result = await sql.unsafe(stmt);
          results.push({
            sql: stmt.substring(0, 100) + (stmt.length > 100 ? '...' : ''),
            rows: Array.isArray(result) ? result.length : 0,
            data: Array.isArray(result) ? result.slice(0, 50) : null,
            success: true,
          });
        } catch (e) {
          results.push({
            sql: stmt.substring(0, 100) + (stmt.length > 100 ? '...' : ''),
            error: e.message,
            success: false,
          });
          break; // Stop on first error
        }
      }

      const allOk = results.every(r => r.success);
      return jsonResponse({
        success: allOk,
        results,
        message: allOk
          ? `✅ ${results.length} comando(s) executado(s) com sucesso.`
          : `❌ Erro na execução. ${results.filter(r => r.success).length}/${results.length} comandos executados.`,
      });
    }

    // === QUERY: Quick read-only query ===
    if (action === 'query') {
      const { sqlCommand } = body;
      if (!sqlCommand || !sqlCommand.trim()) {
        return jsonResponse({ error: 'SQL vazio' }, 400);
      }

      // Only allow SELECT/WITH
      if (!/^\s*(SELECT|WITH|EXPLAIN)/i.test(sqlCommand)) {
        return jsonResponse({ error: 'Apenas SELECT permitido no modo query' }, 400);
      }
      if (/INSERT|UPDATE|DELETE|CREATE|ALTER|DROP/i.test(sqlCommand)) {
        return jsonResponse({ error: 'Comando de escrita não permitido no modo query' }, 400);
      }

      const result = await sql.unsafe(sqlCommand);
      return jsonResponse({
        success: true,
        rows: result.length,
        data: result.slice(0, 100),
      });
    }

    return jsonResponse({ error: 'Ação inválida. Use: export, preview, execute, query' }, 400);

  } catch (e) {
    console.error('[DB Admin Error]', e.message);
    return jsonResponse({ error: 'Erro interno: ' + e.message }, 500);
  }
}
