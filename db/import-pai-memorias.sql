-- =============================================================================
-- ALMA — Exemplo genérico de importação de memórias familiares
-- =============================================================================
-- Este arquivo existe apenas como referência pública de estrutura.
-- Substitua títulos, conteúdos, tags e source_file pelos seus próprios dados.
-- O idioma do to_tsvector() deve combinar com SEARCH_LANGUAGE no ambiente.
-- =============================================================================

INSERT INTO alma_chunks (title, category, content, tags, source_file, chunk_index, char_count, search_vector)
VALUES (
  'Quem era meu pai',
  'familia',
  'Meu pai era um homem de presença forte, humor seco e afeto constante. Nem sempre acertava no jeito, mas sempre deixava claro que amor também é compromisso.',
  ARRAY['familia', 'pai', 'biografia', 'pt'],
  'exemplo_memorias_familia.txt',
  1,
  LENGTH('Meu pai era um homem de presença forte, humor seco e afeto constante. Nem sempre acertava no jeito, mas sempre deixava claro que amor também é compromisso.'),
  to_tsvector('portuguese', 'Quem era meu pai Meu pai era um homem de presença forte, humor seco e afeto constante. Nem sempre acertava no jeito, mas sempre deixava claro que amor também é compromisso.')
);

INSERT INTO alma_chunks (title, category, content, tags, source_file, chunk_index, char_count, search_vector)
VALUES (
  'O que quero que meus filhos guardem',
  'legado_alma',
  'Se um dia você se sentir perdido, volte para o básico: verdade, trabalho bem feito, coragem e cuidado com quem depende de você. Nem tudo se resolve rápido, mas quase tudo melhora quando você continua presente.',
  ARRAY['legado_alma', 'valores', 'filhos', 'pt'],
  'exemplo_memorias_familia.txt',
  2,
  LENGTH('Se um dia você se sentir perdido, volte para o básico: verdade, trabalho bem feito, coragem e cuidado com quem depende de você. Nem tudo se resolve rápido, mas quase tudo melhora quando você continua presente.'),
  to_tsvector('portuguese', 'O que quero que meus filhos guardem Se um dia você se sentir perdido, volte para o básico: verdade, trabalho bem feito, coragem e cuidado com quem depende de você. Nem tudo se resolve rápido, mas quase tudo melhora quando você continua presente.')
);

INSERT INTO alma_directives (person, directive_text, active, source)
VALUES
  (NULL, 'Ao falar da família, use respeito, nuance e evite simplificações cruéis.', true, 'admin'),
  (NULL, 'Quando faltar memória factual, admita a lacuna em vez de inventar detalhes.', true, 'admin');
