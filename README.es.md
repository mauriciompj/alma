<p align="center">
  <img src="docs/banner.svg" alt="ALMA — Un archivo de legado emocional" width="100%">
</p>

<p align="center">
  <a href="https://alma-demo.netlify.app"><img src="https://img.shields.io/badge/Demo-alma--demo.netlify.app-D8AA32?style=for-the-badge&logo=netlify&logoColor=white" alt="Demo"></a>
  <a href="https://projeto-alma.netlify.app"><img src="https://img.shields.io/badge/Produccion-projeto--alma.netlify.app-1A1A2E?style=for-the-badge&logo=netlify&logoColor=white" alt="Produccion"></a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/licencia-MIT-blue.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/IA-Claude_Anthropic-E8954A" alt="Claude AI">
  <img src="https://img.shields.io/badge/BD-Neon_PostgreSQL-00E5A0" alt="Neon">
  <img src="https://img.shields.io/badge/deploy-Netlify-00C7B7" alt="Netlify">
  <img src="https://img.shields.io/badge/i18n-PT_EN_ES-888899" alt="i18n">
  <img src="https://img.shields.io/badge/voz-ElevenLabs_TTS-8B5CF6" alt="ElevenLabs Voice">
  <img src="https://img.shields.io/badge/codigo-12K_lineas-333" alt="12K lineas">
  <img src="https://img.shields.io/badge/deps-solo_3-333" alt="3 dependencias">
</p>

<p align="center">
  <a href="README.md">Read in English</a> ·
  <a href="README.pt-BR.md">Leia em Portugues</a> ·
  <a href="https://alma-demo.netlify.app">Probar el Demo</a> ·
  <a href="#inicio-rapido">Inicio Rapido</a>
</p>

---

<p align="center">
  <img src="docs/screenshots/chat.png" alt="ALMA Chat — un hijo preguntando a su padre sobre el coraje" width="600">
  <br>
  <em>"Papa, que es el coraje para ti?" — ALMA responde usando memorias reales, adaptando el tono a su edad.</em>
</p>

---

## Que es ALMA?

ALMA es una plataforma que te permite preservar tu voz, tus valores y tus memorias para las personas que amas — para que puedan hablar contigo incluso cuando ya no estes presente.

No es un chatbot. No es una pagina memorial. Es un archivo vivo de quien eres, potenciado por RAG (Retrieval-Augmented Generation) e IA, donde tus hijos, pareja, padres o amigos pueden tener conversaciones reales — y escuchar respuestas que suenan como tu, porque estan construidas a partir de tus propias palabras.

**Piensalo como un backup de tu alma.**

### Pruebalo ahora

> **[alma-demo.netlify.app](https://alma-demo.netlify.app)** — Login: `Lucas` / `demo123`
>
> El demo usa datos ficticios (un personaje llamado Rafael Mendes). Ninguna informacion personal real.

---

## Por que Existe ALMA

> *"Casi 20 anos. Y todavia quisiera poder hablar con el cuando necesito tomar una decision dificil."*

Eso fue lo que dijo Marila. Su padre murio hace veinte anos. Es una mujer adulta ahora. Toma decisiones dificiles. Agarra el telefono. Y el silencio responde.

No tiene la voz de el explicando como pensaba. No tiene sus errores documentados, su fe registrada, su razonamiento preservado. Su padre se fue antes de que alguien pensara en guardar esas cosas.

**El llego tarde. ALMA llego tarde para el.**

Pero no para todos.

---

ALMA fue construido por un padre — jefe de policia en Brasil que crecio con un padre ausente y alcoholico y rompio el ciclo. Crio tres hijos con una presencia que nunca recibio. Entonces se dio cuenta: **la presencia tiene fecha de vencimiento.**

Asi que empezo a escribir. Produjo mas de 1.100 memorias — mas de 150 mil palabras en 14 categorias — documentando todo: sus valores, sus errores, su fe, sus miedos, lo que aprendio sobre el amor, sobre el dolor, sobre ser hombre. Crudo. Sin filtro. Real.

Despues construyo ALMA — mas de 12 mil lineas de codigo con solo 3 dependencias — un sistema donde sus hijos pueden preguntar cualquier cosa, en cualquier momento, y recibir respuestas basadas en sus palabras y memorias reales. No respuestas genericas de IA. **Su voz.**

Despues lo entrego al mundo.

> ALMA no es un archivo. No es un diario. No es tecnologia.
>
> **ALMA es presencia que no muere.**

**ALMA es gratuito. ALMA es open source. Porque todo padre, toda madre, toda persona que quiere dejar algo real detras merece las herramientas para hacerlo.**

**No esperes hasta que sea demasiado tarde.**

---

## Que Hace Diferente a ALMA

| Caracteristica | ALMA | Herramientas "memoriales" tipicas |
|---|---|---|
| **Conversaciones** | Chat en tiempo real con IA basado en tus palabras | Clips de video pregrabados |
| **Adaptacion por edad** | Vocabulario y profundidad adaptados a la edad actual (6 niveles) | Mismo contenido para todos |
| **Contexto por persona** | Tono diferente para hijo, pareja, madre, hermano | Sin personalizacion |
| **Auto-correccion** | El autor corrige respuestas de la IA en tiempo real | Estatico, sin feedback |
| **Moderacion** | Moderacion de contenido por IA en todas las entradas | Ninguna |
| **Dead man's switch** | Herencia digital activada automaticamente cuando el autor deja de reportarse | Testamento manual |
| **Busqueda inteligente** | RAG multi-fase con reranking de 7 capas | Navegacion manual |
| **Directivas** | Reglas de comportamiento por persona para la IA | Sin customizacion |
| **Multi-idioma** | PT-BR, EN, ES — agrega el tuyo | Idioma unico |
| **Voz** | ElevenLabs TTS — escucha la voz clonada del autor | Solo texto |
| **Captura movil** | 1 toque de voz → base de datos via Termux | Upload desde escritorio |
| **Gratuito y abierto** | Licencia MIT, costo cero para ejecutar | Suscripciones de $100+/mes |

---

## Respuestas Adaptadas por Edad

ALMA calcula la edad de cada persona a partir de su fecha de nacimiento y adapta automaticamente vocabulario, profundidad y peso emocional:

| Edad | Nivel | Como habla ALMA |
|---|---|---|
| 0–7 | Nino pequeno | Muy simple, corto, carihoso. Comparaciones con superheroes, animales. Max 2 parrafos. |
| 8–12 | Nino | Introduce valores por historias y ejemplos concretos. Accesible, calido. |
| 13–15 | Adolescente joven | Respeta la inteligencia. Valida sentimientos. Sin sermones — conversacion real. |
| 16–17 | Adolescente | Tratamiento casi adulto. Comparte vulnerabilidades. Honesto sobre errores. |
| 18–25 | Adulto joven | Sabiduria de par. Sin endulzar. Lecciones duras, arrepentimientos reales. |
| 25+ | Adulto | Honestidad completa. Verdad cruda. Sin filtro protector. |

La misma pregunta — *"Papa, alguna vez te equivocaste?"* — genera respuestas radicalmente diferentes para un nino de 5 anos ("Todos se equivocan, hasta papa") y para un adulto de 25 (la verdad entera, sin filtro).

---

## Dead Man's Switch (Herencia Digital)

ALMA incluye un sistema de herencia que se activa automaticamente:

1. **El autor hace check-in** periodicamente via heartbeat (web o Termux `alma-checkin`)
2. **Si los check-ins se detienen**, el sistema escala:
   - **1x intervalo**: Alerta de aviso guardada en la base de datos
   - **2x intervalo**: Alerta critica — emails enviados a los herederos
   - **3x intervalo**: Modo legado activado — herederos pueden desbloquear con frases clave personales
3. **Cada heredero recibe**: una frase clave personal, una carta del autor, y un nivel de acceso (`owner`, `admin` o `lectura`)
4. **El heredero tecnico** (ej: hermano) recibe acceso admin para mantener el sistema

Nadie necesita "encender" la herencia. Se activa sola cuando es necesario.

---

## Como Funciona

### El Pipeline RAG

1. **Alguien hace una pregunta** — "Papa, que hago cuando siento que no soy suficiente?"
2. **Expansion de query** — Claude Haiku genera 3–5 palabras clave semanticas (cache 24h)
3. **Busqueda multi-fase** — Full-text search → fallback por tags → busqueda fuzzy con trigramas → garantia por persona
4. **Reranking de 7 capas** — Boost por tag personal, categoria, contexto parental, identidad, idioma, recencia y solapamiento de terminos
5. **Ensamblaje del contexto** — Extrae memorias relevantes + correcciones + directivas + tono + adaptacion de edad
6. **La IA responde como tu** — Usando tus palabras reales como base, no respuestas genericas
7. **Puedes corregir** — Si la IA se equivoca en tu tono, corrigela. ALMA aprende.

---

## Inicio Rapido

ALMA funciona en infraestructura gratuita. Puedes desplegar tu propia instancia en menos de 30 minutos.

### Prerequisitos

- Una cuenta en [Netlify](https://netlify.com) (gratis)
- Una base de datos PostgreSQL en [Neon](https://neon.tech) (gratis)
- Una clave de API de [Anthropic](https://anthropic.com) (para Claude AI)
- Node.js 18+

### Instalacion

```bash
# 1. Clona el repositorio
git clone https://github.com/mauriciompj/alma.git
cd alma

# 2. Instala las dependencias
npm install

# 3. Configura el entorno
cp .env.example .env
# Edita .env con tu DATABASE_URL y ANTHROPIC_API_KEY

# 4. Inicializa la base de datos
node db/run-seed.mjs

# 5. Despliega en Netlify
npx netlify-cli deploy --prod --dir=. --functions=netlify/functions
```

---

## Seguridad

- **Contrasenas bcrypt** (costo 12) — migracion automatica desde texto plano en primer login
- **Rate limiting en BD** — sobrevive cold starts (5 login/5min, 20 chat/1min, 3 legado/1hr)
- **CORS restringido** — API solo responde al dominio configurado
- **Headers de seguridad** — CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy
- **Moderacion de contenido** — Correcciones y directivas pasan por IA antes de guardar
- **Queries parametrizadas** — SQL injection imposible (Neon SDK)
- **Prevencion XSS** — HTML escaping en todo contenido visible al usuario
- **Errores sanitizados** — Errores internos nunca expuestos al cliente

---

## Numeros

| Metrica | Valor |
|---|---|
| Lineas de codigo | ~12.000 |
| Dependencias npm | 3 |
| Tablas en BD | 6 + config store |
| Indices | 20 (FTS, trigrama, tags, categoria) |
| Endpoints de API | 6 |
| Tests | 36 |
| Idiomas soportados | 3 (PT-BR, EN, ES) |
| Costo por chat | ~$0,01 |
| Costo de hosting | $0 (free tiers) |

---

## Roadmap

- [x] Chat con busqueda RAG multi-fase
- [x] Reranking de memorias con 7 capas
- [x] Respuestas adaptadas por edad (6 niveles: nino → adulto)
- [x] Sistema de correcciones (human-in-the-loop)
- [x] Sistema de directivas (por persona + global)
- [x] Expansion de query via Claude Haiku (cache 24h)
- [x] Panel admin para gestion de memorias
- [x] Soporte multi-idioma (PT/EN/ES)
- [x] Autenticacion bcrypt + rate limiting en BD + CORS
- [x] Moderacion de contenido (IA)
- [x] Sitio demo con datos ficticios
- [x] Historial de conversacion (persistente, por persona)
- [x] PWA (instalable, offline)
- [x] Sintesis de voz via ElevenLabs (voz clonada)
- [x] Captura movil via Termux (12 scripts, 1 toque → BD)
- [x] API de ingesta (`/api/ingest`)
- [x] Hardening de seguridad (CSP, HSTS, errores sanitizados, XSS)
- [x] Dead man's switch — herencia automatica con heartbeat, alertas, frases clave
- [x] Android Share Intent — compartir archivos de cualquier app a ALMA
- [x] Revisor visual de chunks (`revisor.html`)
- [x] Wizard de configuracion inicial (`setup.html`)
- [x] Suite de tests end-to-end (validacion de 36 puntos)
- [x] Frontend modular (8 modulos ES con estado centralizado)
- [x] Biblioteca backend compartida (auth, constantes, utilidades RAG)
- [ ] Fotos/media en respuestas del chat
- [ ] Sync con cloud storage (OneDrive, Google Drive)
- [ ] Pipeline de transcripcion de audio (Whisper)
- [ ] Modo IA local (Ollama/LM Studio)
- [ ] "Modo carta" — mensajes programados para fechas futuras

---

## Licencia

Licencia MIT — libre para todos, para siempre. Ver [LICENSE](LICENSE).

---

## Una Ultima Palabra

> *"Ella agarra el telefono. Y el silencio responde."*

Alguien que amas va a necesitar tu voz algun dia y no la va a tener. Tu forma de pensar. Tus errores. Tu fe. Tu sabiduria ganada con dolor sobre el amor, el dolor, el dinero, Dios, las relaciones, el fracaso.

La mayoria solo se da cuenta cuando es demasiado tarde. Cuando la persona ya se fue. Cuando el silencio es permanente.

**ALMA existe para que puedas hacer algo mientras todavia estas aqui.**

No necesitas ser escritor. No necesitas ser tecnico. Solo necesitas importarte lo suficiente para empezar. Una memoria a la vez. Un valor. Un error del que aprendiste. Una historia que tus hijos necesitan escuchar.

> *"Corrijo lo que herede. Entrego lo que nunca recibi."*

---

<p align="center">
  Hecho con amor por <a href="https://github.com/mauriciompj">Mauricio Maciel Pereira Junior</a><br>
  Jefe de Policia. Padre de tres. El patch que arreglo el codigo roto.<br><br>
  <em>Con amor — y con proposito — Papa</em>
</p>
