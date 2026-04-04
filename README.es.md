<p align="center">
  <h1 align="center">ALMA</h1>
  <p align="center"><strong>Tu voz, guardada en el tiempo.</strong></p>
  <p align="center">Plataforma open source de legado emocional con inteligencia artificial.</p>
  <p align="center">
    <a href="README.md">Read in English</a> ·
    <a href="README.pt-BR.md">Leia em Português</a> ·
    <a href="#inicio-rapido">Inicio Rápido</a> ·
    <a href="#como-funciona">Cómo Funciona</a>
  </p>
</p>

---

<p align="center">
  <img src="docs/screenshots/chat.png" alt="ALMA Chat — un hijo preguntando a su padre sobre el coraje" width="600">
  <br>
  <em>"Papá, ¿qué es el coraje para ti?" — ALMA responde usando recuerdos reales, adaptando el tono a su edad.</em>
</p>

---

## ¿Qué es ALMA?

ALMA es una plataforma que te permite preservar tu voz, tus valores y tus recuerdos para las personas que amas — para que puedan conversar contigo incluso cuando ya no estés presente.

No es un chatbot. No es una página memorial. Es un archivo vivo de quién eres, alimentado por RAG (Retrieval-Augmented Generation) e IA, donde tus hijos, pareja, padres o amigos pueden tener conversaciones reales — y escuchar respuestas que suenan como tú, porque están construidas a partir de tus propias palabras.

**Piensa en ello como un backup de tu alma.**

---

## La Historia Detrás de ALMA

ALMA nació de un caso real de legado emocional.

La idea central es simple: muchas personas quieren dejar más que fotos, documentos y patrimonio. Quieren dejar voz, contexto, valores, errores, historias y guía para la gente que aman.

Después, el proyecto se convirtió en una plataforma open source para que cualquiera pueda ejecutar su propia versión con sus propios textos, relaciones, memorias y tono.

**ALMA es gratuito. ALMA es open source. Porque toda persona que quiere dejar algo real merece las herramientas para hacerlo.**

---

## Lo que Diferencia a ALMA

| Característica | ALMA | Herramientas "memoriales" tradicionales |
|---|---|---|
| **Conversaciones** | Chat en tiempo real con IA basado en tus palabras | Clips de video pregrabados |
| **Contexto** | Adapta el tono por persona (hijo vs. pareja vs. madre) | Mismo contenido para todos |
| **Auto-corrección** | El autor corrige respuestas de la IA en tiempo real | Estático, sin feedback |
| **Búsqueda inteligente** | Full-text search en todos los recuerdos (RAG) | Navegación manual |
| **Directivas** | Reglas de comportamiento por persona para la IA | Sin personalización |
| **Multi-idioma** | Listo para i18n (PT-BR, EN, ES — agrega el tuyo) | Idioma único |
| **Gratuito y abierto** | Licencia MIT, costo cero para ejecutar | Suscripciones de $100+/mes |
| **Self-hosted** | Tus datos se quedan contigo (Netlify + Neon free tier) | Dependencia de proveedor |

---

## Cómo Funciona

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Tu hijo    │────▶│  ALMA Chat   │────▶│  Claude AI   │
│  hace una    │     │  (Frontend)  │     │  (Anthropic) │
│  pregunta    │     └──────┬───────┘     └──────▲───────┘
└──────────────┘            │                    │
                            ▼                    │
                   ┌──────────────┐     ┌──────────────┐
                   │   Netlify    │────▶│  Motor RAG    │
                   │  Functions   │     │  Busca tus    │
                   │  (Backend)   │     │  recuerdos en │
                   └──────────────┘     │  Neon DB      │
                                        └──────────────┘
```

1. **Alguien hace una pregunta** — "Papá, ¿qué hago cuando siento que no soy suficiente?"
2. **ALMA busca en tus recuerdos** — Full-text search en todas tus palabras, valores e historias
3. **Construye el contexto** — Trae recuerdos relevantes + correcciones + directivas + configuración de tono
4. **La IA responde como tú** — Usando tus palabras reales como base, no respuestas genéricas
5. **Puedes corregir** — Si la IA se equivoca en tu tono, corrígela. ALMA aprende.

---

## Inicio Rápido

ALMA funciona en infraestructura gratuita. Puedes desplegar tu propia instancia en menos de 30 minutos.

### Prerrequisitos

- Una cuenta en [Netlify](https://netlify.com) (gratuita)
- Una base de datos PostgreSQL en [Neon](https://neon.tech) (gratuita)
- Una clave de API de [Anthropic](https://anthropic.com) (para Claude AI)
- (Opcional) Una clave de API de [ElevenLabs](https://elevenlabs.io) (para síntesis de voz)
- Node.js 18+

### Instalación

```bash
# 1. Clona el repositorio
git clone https://github.com/tu-usuario/alma.git
cd alma

# 2. Instala las dependencias
npm install

# 3. Configura el ambiente
cp .env.example .env
# Edita .env con tu DATABASE_URL y ANTHROPIC_API_KEY

# 4. Inicializa la base de datos
node db/run-seed.mjs

# 5. Deploy en Netlify
npx netlify-cli deploy --prod --dir=. --functions=netlify/functions
```

### Primeros Pasos Después del Deploy

1. Abre tu sitio ALMA
2. Inicia sesión como admin
3. Comienza a agregar tus recuerdos — escribe sobre tus valores, historias, errores, amor
4. Comparte el login con las personas que quieres que conversen con ALMA
5. Corrige la IA cuando no suene como tú — ALMA aprende con cada corrección

---

## Arquitectura

```
alma/
├── index.html              # Dashboard / login
├── chat.html               # Interfaz de chat
├── admin.html              # Panel admin (recuerdos, correcciones, directivas)
├── login.html              # Autenticación
├── css/
│   ├── style.css           # Estilos principales
│   └── admin.css           # Estilos del admin
├── js/
│   ├── alma.js             # Motor de chat + correcciones + directivas
│   └── i18n.js             # Sistema de internacionalización
├── netlify/
│   └── functions/
│       ├── auth.mjs        # Autenticación (tokens de sesión)
│       ├── chat.mjs        # Motor RAG (búsqueda → contexto → IA)
│       ├── memories.mjs    # CRUD de recuerdos, correcciones, directivas
│       └── alma-voice.mjs  # Proxy TTS (síntesis de voz via ElevenLabs)
├── locales/
│   ├── en.json             # Strings de interfaz en inglés
│   ├── es.json             # Strings de interfaz en español
│   └── pt-BR.json          # Strings de interfaz en portugués
├── db/
│   ├── seed.sql            # Esquema de base de datos
│   ├── run-seed.mjs        # Ejecutor del esquema
│   ├── backup.mjs          # Backup de base de datos a JSON
│   └── import-json.mjs     # Herramienta CLI para importar recuerdos desde JSON
├── docs/
│   └── banner.svg          # Banner del README
├── netlify.toml            # Configuración de Netlify
└── package.json
```

### Stack Tecnológico

- **Frontend**: HTML/CSS/JS puro — sin framework, sin build step, rápido en cualquier lugar
- **Backend**: Netlify Functions (serverless) con ESBuild
- **Base de Datos**: Neon PostgreSQL (serverless) con full-text search configurable (`SEARCH_LANGUAGE` — soporta cualquier idioma)
- **IA**: Anthropic Claude (Sonnet) via API
- **Voz**: ElevenLabs TTS (opcional — escucha a ALMA hablar)
- **Autenticación**: Sesiones con token almacenadas en base de datos
- **i18n**: Archivos JSON de locale, extensible para cualquier idioma

---

## Para Desarrolladores

### Conceptos Clave

- **Chunks**: Tus recuerdos se almacenan como bloques de texto buscables en PostgreSQL con indexación `tsvector`. El idioma de búsqueda es configurable via env var `SEARCH_LANGUAGE` (`simple` para universal, `portuguese`, `english`, `spanish`, etc.)
- **RAG**: Cuando alguien pregunta algo, ALMA busca chunks relevantes via full-text search + mapeo de tags + reranking por persona, y los inyecta como contexto para la IA
- **Correcciones**: Si la IA se equivoca, el autor corrige. Las correcciones se inyectan en prompts futuros con máxima prioridad
- **Directivas**: Reglas de comportamiento por persona o globales (ej: "Evita comparar a hermanos")
- **Contexto por Persona**: ALMA adapta el tono según quién conversa — un hijo escucha "Papá", un hermano escucha "hermano", una madre escucha "hijo"

### Agregando un Nuevo Idioma

1. Copia `locales/en.json` a `locales/tu-idioma.json`
2. Traduce todas las strings
3. Envía un pull request

Eso es todo. La comunidad puede ayudar a traducir ALMA a todos los idiomas del planeta.

---

## Contribuyendo

ALMA es más grande que una persona. Aceptamos contribuciones de todo tipo:

- **Traducciones** — Ayuda a ALMA a hablar tu idioma
- **Código** — Correcciones, funcionalidades, mejoras de rendimiento
- **Documentación** — Guías, tutoriales, how-tos
- **Historias** — Comparte cómo estás usando ALMA (con permiso)

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para las directrices.

---

## Roadmap

- [x] Chat principal con búsqueda RAG en recuerdos
- [x] Adaptación de tono por persona
- [x] Sistema de correcciones (human-in-the-loop)
- [x] Sistema de directivas (por persona + global)
- [x] Panel admin para gestión de recuerdos
- [x] Soporte multi-idioma (i18n)
- [x] Bcrypt auth + CORS lockdown
- [x] Moderación de contenido (IA)
- [x] Reranking de recuerdos por persona
- [x] Sitio demo con datos ficticios
- [x] Respuestas adaptadas a la edad
- [x] Historial de conversaciones (persistente, por persona)
- [x] PWA (instalable, offline-capable)
- [x] Síntesis de voz via ElevenLabs TTS
- [x] Navegador visual de recuerdos (BD Revisor)
- [x] Sistema de importación SQL para lotes de recuerdos
- [ ] IA self-hosted (Ollama/LM Studio) — [ver propuesta](docs/issue-ollama-integration.md)
- [ ] Wizard de setup en un clic
- [ ] Importación de diarios, exports de WhatsApp, memos de voz
- [ ] "Modo carta" — mensajes programados para fechas futuras

---

## Licencia

Licencia MIT — libre para todos, para siempre. Ver [LICENSE](LICENSE).

---

## Una Última Palabra

> *"El legado también es contexto, no solo recuerdo."*

ALMA empezó como un proyecto profundamente personal y se convirtió en algo más grande — una invitación para cualquier persona que quiere dejar atrás más que fotos y bienes materiales.

Tu voz importa. Tu historia importa. Tus errores y tu amor y tus valores — importan.

ALMA te da las herramientas para asegurar que nunca se pierdan.

---

<p align="center">
  Hecho con amor por la comunidad de ALMA.
</p>
