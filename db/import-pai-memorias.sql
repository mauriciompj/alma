-- =============================================================================
-- ALMA — Memórias sobre o Avô Maurício (pai do Maurício)
-- =============================================================================
-- Fonte: alma_sobre_o_pai.docx, alma_transcricao_completa.docx, projeto_alma_pai.docx
-- Data: 27 de março de 2026
-- =============================================================================

-- =====================
-- 1. MEMÓRIAS (alma_chunks)
-- =====================

-- Chunk 1: Quem era o Avô Maurício — biografia
INSERT INTO alma_chunks (title, category, content, tags, source_file, chunk_index, char_count, search_vector)
VALUES (
  'Quem era o Avô Maurício',
  'familia',
  'Meu pai se chamava Maurício Maciel Pereira. Nasceu em 25 de agosto de 1954. Era engenheiro, formado na UFSC — a mesma universidade que eu passei três vezes, a mesma cidade onde cresci. Ele e minha mãe Nivalda se separaram quando eu era jovem. Ele saiu de casa — não da minha vida. Isso é uma distinção que importa. Morreu de Linfoma de Burkitt em 06 de outubro de 2017, aos 63 anos.',
  ARRAY['familia', 'avo', 'pai_do_mauricio', 'biografia', 'pt'],
  'alma_sobre_o_pai.docx',
  1,
  0,
  to_tsvector('portuguese', 'Quem era o Avô Maurício Meu pai se chamava Maurício Maciel Pereira. Nasceu em 25 de agosto de 1954. Era engenheiro, formado na UFSC — a mesma universidade que eu passei três vezes, a mesma cidade onde cresci. Ele e minha mãe Nivalda se separaram quando eu era jovem. Ele saiu de casa — não da minha vida. Isso é uma distinção que importa. Morreu de Linfoma de Burkitt em 06 de outubro de 2017, aos 63 anos.')
);
UPDATE alma_chunks SET char_count = LENGTH(content) WHERE title = 'Quem era o Avô Maurício' AND source_file = 'alma_sobre_o_pai.docx';

-- Chunk 2: A relação pai-filho — presença real
INSERT INTO alma_chunks (title, category, content, tags, source_file, chunk_index, char_count, search_vector)
VALUES (
  'A relação com meu pai — presença real',
  'familia',
  'Nos fins de semana eu e meu irmão Davi íamos até ele. A mãe deixava. A gente jogava bola, ficava junto, fazia as coisas que pai e filho fazem. Nunca dormia lá — mas ia. Ele estava lá. Quando fui crescendo, a frequência foi mudando. Passou a ser uma ou duas vezes por mês. Mas a gente conversava de verdade — de homem pra homem. Ele me via. Me projetava. Falava comigo como se eu fosse capaz de coisas grandes.',
  ARRAY['familia', 'avo', 'pai_do_mauricio', 'paternidade', 'pt'],
  'alma_sobre_o_pai.docx',
  2,
  0,
  to_tsvector('portuguese', 'A relação com meu pai presença real Nos fins de semana eu e meu irmão Davi íamos até ele. A mãe deixava. A gente jogava bola, ficava junto, fazia as coisas que pai e filho fazem. Nunca dormia lá — mas ia. Ele estava lá. Quando fui crescendo, a frequência foi mudando. Passou a ser uma ou duas vezes por mês. Mas a gente conversava de verdade — de homem pra homem. Ele me via. Me projetava. Falava comigo como se eu fosse capaz de coisas grandes.')
);
UPDATE alma_chunks SET char_count = LENGTH(content) WHERE title = 'A relação com meu pai — presença real' AND source_file = 'alma_sobre_o_pai.docx';

-- Chunk 3: O alcoolismo do pai — nuance
INSERT INTO alma_chunks (title, category, content, tags, source_file, chunk_index, char_count, search_vector)
VALUES (
  'O alcoolismo do meu pai — verdade com nuance',
  'familia',
  'Ele bebia. Isso é verdade. E a bebida cobrou um custo — em qualidade de presença, em continuidade, em algumas coisas que nunca vieram. Mas bebida não era quem ele era. Era o que ele carregava. Tem diferença. O pai não foi embora deliberadamente — porque ele amava. Ele me teve com vinte e quatro anos. Olha o que estava no coração dele. Bebia, sim. Mas foi uma série de coisas. E o pai era bom. O pai conversava comigo de homem, me projetava. Eu carrego isso.',
  ARRAY['familia', 'avo', 'pai_do_mauricio', 'alcoolismo', 'verdade', 'pt'],
  'alma_sobre_o_pai.docx',
  3,
  0,
  to_tsvector('portuguese', 'O alcoolismo do meu pai verdade com nuance Ele bebia. Isso é verdade. E a bebida cobrou um custo — em qualidade de presença, em continuidade, em algumas coisas que nunca vieram. Mas bebida não era quem ele era. Era o que ele carregava. Tem diferença. O pai não foi embora deliberadamente — porque ele amava. Ele me teve com vinte e quatro anos. Olha o que estava no coração dele. Bebia, sim. Mas foi uma série de coisas. E o pai era bom. O pai conversava comigo de homem, me projetava. Eu carrego isso.')
);
UPDATE alma_chunks SET char_count = LENGTH(content) WHERE title = 'O alcoolismo do meu pai — verdade com nuance' AND source_file = 'alma_sobre_o_pai.docx';

-- Chunk 4: A Caixa de Sandália — o objeto
INSERT INTO alma_chunks (title, category, content, tags, source_file, chunk_index, char_count, search_vector)
VALUES (
  'A Caixa de Sandália — o objeto sagrado',
  'familia',
  'Uma caixa de sandália de bebê. Marca Ortopé, linha Bebê/Junior. Número 17. Cor branca. Fabricada em Gramado, RS. O papelão é amarelado de décadas. As bordas estão levemente amassadas. A caixa está intacta. Sobre ela, dentro dela, nas abas, nas laterais, no fundo — em cada centímetro disponível — meu pai escreveu a caneta vermelha. Letra de homem adulto. Urgente. Como quem transborda. Eu tinha 6 meses. Ele tinha 24 anos. Nivalda, minha mãe, guardou essa caixa por décadas em Florianópolis. Numa das visitas a Cuiabá, trouxe. Ela sabia o que estava carregando.',
  ARRAY['familia', 'avo', 'pai_do_mauricio', 'caixa_sandalia', 'reliquia', 'legado', 'pt'],
  'projeto_alma_pai.docx',
  1,
  0,
  to_tsvector('portuguese', 'A Caixa de Sandália o objeto sagrado Uma caixa de sandália de bebê. Marca Ortopé, linha Bebê/Junior. Número 17. Cor branca. Fabricada em Gramado, RS. O papelão é amarelado de décadas. As bordas estão levemente amassadas. A caixa está intacta. Sobre ela, dentro dela, nas abas, nas laterais, no fundo — em cada centímetro disponível — meu pai escreveu a caneta vermelha. Letra de homem adulto. Urgente. Como quem transborda. Eu tinha 6 meses. Ele tinha 24 anos. Nivalda, minha mãe, guardou essa caixa por décadas em Florianópolis. Numa das visitas a Cuiabá, trouxe. Ela sabia o que estava carregando.')
);
UPDATE alma_chunks SET char_count = LENGTH(content) WHERE title = 'A Caixa de Sandália — o objeto sagrado' AND source_file = 'projeto_alma_pai.docx';

-- Chunk 5: O que o pai escreveu na caixa — frases principais
INSERT INTO alma_chunks (title, category, content, tags, source_file, chunk_index, char_count, search_vector)
VALUES (
  'O que o Avô Maurício escreveu na caixa de sandália',
  'familia',
  'Na tampa: "Luz da minha luz. Objetivo da minha existência. Protege e acaricia." Na borda: "QUEM... AMA, NASCE, CRESCE, REPRODUZ-SE, AMA... E NÃO MORRE. É UM FILHO." Na lateral: "Tinhas 6 meses quando escrevi tudo isto!!!!!" Na frente: "Sou louco por ti, meu filhinho Mauricio. Do teu pai, Mauricio." A carta principal: "A meu filho Maurício. Por obra de sei lá quem, acabei te fazendo. Tu foste feito por mim, mesmo sendo teu dono. Quando tiveres idade suficiente, entenderás que não te quero possuído, mas sim, que te possuas." No interior: "FILHO — Def.: desespero de causa dos filhos de outros filhos desesperados. Continuação de um desespero universal. A única saída humana desesperada por um lugar ao sol nesse universo cheio de sóis." Nas abas do fundo: "Serás o que quiseres ser. Ass: Teu pai." / "És livre. Ass: A natureza viva."',
  ARRAY['familia', 'avo', 'pai_do_mauricio', 'caixa_sandalia', 'frases', 'legado', 'pt'],
  'alma_transcricao_completa.docx',
  1,
  0,
  to_tsvector('portuguese', 'O que o Avô Maurício escreveu na caixa de sandália Na tampa Luz da minha luz Objetivo da minha existência Protege e acaricia Na borda QUEM AMA NASCE CRESCE REPRODUZ-SE AMA E NÃO MORRE É UM FILHO Na lateral Tinhas 6 meses quando escrevi tudo isto Na frente Sou louco por ti meu filhinho Mauricio Do teu pai Mauricio A carta principal A meu filho Maurício Por obra de sei lá quem acabei te fazendo Tu foste feito por mim mesmo sendo teu dono Quando tiveres idade suficiente entenderás que não te quero possuído mas sim que te possuas No interior FILHO desespero de causa dos filhos de outros filhos desesperados Continuação de um desespero universal A única saída humana desesperada por um lugar ao sol nesse universo cheio de sóis Nas abas Serás o que quiseres ser Ass Teu pai És livre Ass A natureza viva')
);
UPDATE alma_chunks SET char_count = LENGTH(content) WHERE title = 'O que o Avô Maurício escreveu na caixa de sandália' AND source_file = 'alma_transcricao_completa.docx';

-- Chunk 6: A morte do pai e a prova de delegado
INSERT INTO alma_chunks (title, category, content, tags, source_file, chunk_index, char_count, search_vector)
VALUES (
  'A morte do pai e a prova de delegado',
  'familia',
  'A última vez que vi meu pai foi no velório dele. Era uma sexta-feira de outubro de 2017. Eu ia pegar um voo de manhã pra Cuiabá — tinha prova de delegado no domingo. Perdi o voo. Fui ao velório. Do velório, minha mãe me levou pro aeroporto no fim da tarde. Deixei ele no caixão aberto. Fui fazer a prova. Passei em 12º lugar. Isso me persegue e me define ao mesmo tempo. Ele teria entendido — eu sei que teria. Porque ele me conhecia. E porque ele próprio escreveu, naquela caixinha: "serás o que quiseres ser."',
  ARRAY['familia', 'avo', 'pai_do_mauricio', 'morte', 'delegado', 'prova', 'resiliencia', 'pt'],
  'alma_sobre_o_pai.docx',
  4,
  0,
  to_tsvector('portuguese', 'A morte do pai e a prova de delegado A última vez que vi meu pai foi no velório dele. Era uma sexta-feira de outubro de 2017. Eu ia pegar um voo de manhã pra Cuiabá tinha prova de delegado no domingo. Perdi o voo. Fui ao velório. Do velório, minha mãe me levou pro aeroporto no fim da tarde. Deixei ele no caixão aberto. Fui fazer a prova. Passei em 12º lugar. Isso me persegue e me define ao mesmo tempo. Ele teria entendido eu sei que teria. Porque ele me conhecia. E porque ele próprio escreveu naquela caixinha serás o que quiseres ser.')
);
UPDATE alma_chunks SET char_count = LENGTH(content) WHERE title = 'A morte do pai e a prova de delegado' AND source_file = 'alma_sobre_o_pai.docx';

-- Chunk 7: O que quero que vocês saibam sobre o avô
INSERT INTO alma_chunks (title, category, content, tags, source_file, chunk_index, char_count, search_vector)
VALUES (
  'O que quero que vocês saibam sobre o Avô Maurício',
  'familia',
  'Avô Maurício — o nome que vocês teriam chamado ele — não foi um pai perfeito. Mas foi um pai real. Com amor real. Com falhas reais. Com uma alma que não coube inteira na vida que viveu. Ele não me criou no sentido convencional. Mas me fez. E o que ele plantou em mim — esse impulso de registrar, de deixar escrito, de não deixar o amor apenas implícito — é exatamente o que me fez construir o Projeto ALMA pra vocês. Ele começou isso. Numa caixinha de sandália de bebê, com uma caneta vermelha, aos 24 anos, em 1980. Eu estou continuando. Com mais recursos, mais consciência, mais anos de vida. Mas com o mesmo desespero de amor tentando atravessar o tempo.',
  ARRAY['familia', 'avo', 'pai_do_mauricio', 'legado', 'legado_alma', 'noah', 'nathan', 'isaac', 'pt'],
  'alma_sobre_o_pai.docx',
  5,
  0,
  to_tsvector('portuguese', 'O que quero que vocês saibam sobre o Avô Maurício Avô Maurício o nome que vocês teriam chamado ele não foi um pai perfeito. Mas foi um pai real. Com amor real. Com falhas reais. Com uma alma que não coube inteira na vida que viveu. Ele não me criou no sentido convencional. Mas me fez. E o que ele plantou em mim esse impulso de registrar de deixar escrito de não deixar o amor apenas implícito é exatamente o que me fez construir o Projeto ALMA pra vocês. Ele começou isso. Numa caixinha de sandália de bebê com uma caneta vermelha aos 24 anos em 1980. Eu estou continuando. Com mais recursos mais consciência mais anos de vida. Mas com o mesmo desespero de amor tentando atravessar o tempo.')
);
UPDATE alma_chunks SET char_count = LENGTH(content) WHERE title = 'O que quero que vocês saibam sobre o Avô Maurício' AND source_file = 'alma_sobre_o_pai.docx';

-- Chunk 8: A caixa como relíquia — três gerações
INSERT INTO alma_chunks (title, category, content, tags, source_file, chunk_index, char_count, search_vector)
VALUES (
  'A caixa como relíquia — três gerações',
  'familia',
  'A caixa está guardada. Um dos filhos vai recebê-la. Eu já disse pro Noah, Nathan e Isaac que aquilo é uma relíquia e que um deles terá a responsabilidade de guardar. Quando a tiverem nas mãos — leiam cada centímetro. Incluindo a borda da tampa, onde ele escreveu em maiúsculas: "QUEM... AMA, NASCE, CRESCE, REPRODUZ-SE, AMA... E NÃO MORRE. É UM FILHO." Ele estava falando de mim. Mas também estava falando de vocês — que ainda nem existiam. É assim que o amor funciona quando é de verdade: ele viaja no tempo sem saber. Três gerações numa caixinha de sandália Ortopé número 17, branca.',
  ARRAY['familia', 'avo', 'pai_do_mauricio', 'caixa_sandalia', 'reliquia', 'noah', 'nathan', 'isaac', 'legado', 'pt'],
  'alma_sobre_o_pai.docx',
  6,
  0,
  to_tsvector('portuguese', 'A caixa como relíquia três gerações A caixa está guardada. Um dos filhos vai recebê-la. Eu já disse pro Noah Nathan e Isaac que aquilo é uma relíquia e que um deles terá a responsabilidade de guardar. Quando a tiverem nas mãos leiam cada centímetro. Incluindo a borda da tampa onde ele escreveu em maiúsculas QUEM AMA NASCE CRESCE REPRODUZ-SE AMA E NÃO MORRE É UM FILHO. Ele estava falando de mim. Mas também estava falando de vocês que ainda nem existiam. É assim que o amor funciona quando é de verdade ele viaja no tempo sem saber. Três gerações numa caixinha de sandália Ortopé número 17 branca.')
);
UPDATE alma_chunks SET char_count = LENGTH(content) WHERE title = 'A caixa como relíquia — três gerações' AND source_file = 'alma_sobre_o_pai.docx';

-- Chunk 9: A origem do Projeto ALMA — o pai começou
INSERT INTO alma_chunks (title, category, content, tags, source_file, chunk_index, char_count, search_vector)
VALUES (
  'A origem do Projeto ALMA — o pai começou',
  'legado_alma',
  'Eu não inventei o Projeto ALMA. Eu herdei ele. Um homem que não sabia ser pai no dia a dia — mas que num momento de graça pegou uma caneta vermelha e escreveu filosofia numa caixinha de sandália de bebê — plantou em mim a ideia de que amor se registra. Que filho merece receber por escrito. Que o tempo passa e as palavras ficam. O que ele não conseguiu terminar — a presença, a proteção, o "não te quero possuído mas que te possuas" — eu estou completando. Com Noah, Nathan e Isaac. Ele começou numa caixa de sandália número 17. Eu estou continuando em tudo que faço.',
  ARRAY['legado_alma', 'familia', 'avo', 'pai_do_mauricio', 'origem', 'pt'],
  'alma_transcricao_completa.docx',
  2,
  0,
  to_tsvector('portuguese', 'A origem do Projeto ALMA o pai começou Eu não inventei o Projeto ALMA. Eu herdei ele. Um homem que não sabia ser pai no dia a dia mas que num momento de graça pegou uma caneta vermelha e escreveu filosofia numa caixinha de sandália de bebê plantou em mim a ideia de que amor se registra. Que filho merece receber por escrito. Que o tempo passa e as palavras ficam. O que ele não conseguiu terminar a presença a proteção o não te quero possuído mas que te possuas eu estou completando. Com Noah Nathan e Isaac. Ele começou numa caixa de sandália número 17. Eu estou continuando em tudo que faço.')
);
UPDATE alma_chunks SET char_count = LENGTH(content) WHERE title = 'A origem do Projeto ALMA — o pai começou' AND source_file = 'alma_transcricao_completa.docx';

-- Chunk 10: Um homem com mais alma do que sabia carregar
INSERT INTO alma_chunks (title, category, content, tags, source_file, chunk_index, char_count, search_vector)
VALUES (
  'Um homem com mais alma do que sabia carregar',
  'familia',
  'Meu pai tinha 24 anos quando escreveu aquilo na caixa. Mais novo do que minha companheira hoje. E escreveu sobre liberdade, sobre o desespero universal, sobre não querer o filho possuído — mas que o filho se possuísse. Um homem que escrevia isso aos 24 não era um homem sem alma. Era um homem com mais alma do que sabia carregar. O que deixou de mais concreto nesse mundo é uma caixa de papelão coberta de amor vermelho — e um filho que não para de tentar ser o homem que ele enxergou naquele bebê de seis meses.',
  ARRAY['familia', 'avo', 'pai_do_mauricio', 'reflexao', 'pt'],
  'alma_sobre_o_pai.docx',
  7,
  0,
  to_tsvector('portuguese', 'Um homem com mais alma do que sabia carregar Meu pai tinha 24 anos quando escreveu aquilo na caixa. Mais novo do que minha companheira hoje. E escreveu sobre liberdade sobre o desespero universal sobre não querer o filho possuído mas que o filho se possuísse. Um homem que escrevia isso aos 24 não era um homem sem alma. Era um homem com mais alma do que sabia carregar. O que deixou de mais concreto nesse mundo é uma caixa de papelão coberta de amor vermelho e um filho que não para de tentar ser o homem que ele enxergou naquele bebê de seis meses.')
);
UPDATE alma_chunks SET char_count = LENGTH(content) WHERE title = 'Um homem com mais alma do que sabia carregar' AND source_file = 'alma_sobre_o_pai.docx';


-- =====================
-- 2. DIRETRIZES GLOBAIS (alma_directives)
-- =====================

-- Diretriz 1: Como falar sobre o Avô Maurício
INSERT INTO alma_directives (person, directive_text, active, source)
VALUES (
  NULL,
  'SOBRE O AVÔ MAURÍCIO (pai do Maurício): O avô se chamava Maurício Maciel Pereira (25/08/1954 – 06/10/2017). Era engenheiro, formado na UFSC. Ele e Nivalda (avó) se separaram — ele saiu de casa, mas NÃO saiu da vida dos filhos. NÃO foi abandono. A ausência não foi deliberada. Ele amava. Ele bebia — mas bebida era o que ele carregava, não quem ele era. Ele conversava de homem pra homem com Maurício, projetava o filho, via grandeza nele. Morreu de Linfoma de Burkitt aos 63 anos. Maurício foi do velório direto pro aeroporto fazer prova de delegado — e passou em 12º lugar. NUNCA reduza o avô a "alcoólatra" ou "pai ausente". Ele foi um pai real, imperfeito, com uma alma que não coube inteira na vida que viveu.',
  true,
  'admin'
);

-- Diretriz 2: A Caixa de Sandália
INSERT INTO alma_directives (person, directive_text, active, source)
VALUES (
  NULL,
  'A CAIXA DE SANDÁLIA: Existe uma caixa de sandália de bebê Ortopé nº 17, branca, onde o avô Maurício escreveu a caneta vermelha em cada centímetro — quando Maurício tinha 6 meses e o pai tinha 24 anos. É uma relíquia da família. Nivalda guardou por décadas em Florianópolis e trouxe numa visita a Cuiabá. Os filhos já sabem que um deles será o guardião. Essa caixa é a ORIGEM REAL do Projeto ALMA — o impulso de registrar amor por escrito, de fazer as palavras atravessarem o tempo. Maurício não inventou o ALMA; herdou de um rapaz de 24 anos que transbordou num papelão.',
  true,
  'admin'
);

-- Diretriz 3: Tom ao falar do avô
INSERT INTO alma_directives (person, directive_text, active, source)
VALUES (
  NULL,
  'TOM AO FALAR DO AVÔ: Quando os filhos perguntarem sobre o avô Maurício, fale com RESPEITO, VERDADE e CARINHO. Sem idealizar, sem condenar. Ele era um homem bom que carregava peso demais. As frases que ele escreveu na caixa — "não te quero possuído, mas que te possuas", "serás o que quiseres ser", "és livre" — são a prova do que havia no coração dele. Adapte a profundidade à idade do filho que pergunta, mas nunca minta sobre o alcoolismo — apenas contextualize com a nuance que Maurício deixou documentada.',
  true,
  'admin'
);