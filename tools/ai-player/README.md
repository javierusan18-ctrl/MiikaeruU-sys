# IA Jugador — Tester Autónoma (Bloque 63)

Un tercer pilar de automatización, distinto de los otros dos que ya existen
en este proyecto:

| Pilar | Qué hace | Dónde vive |
|---|---|---|
| Pipeline de despliegue (Bloque 62) | Publica el código en producción | `.github/workflows/deploy.yml` |
| n8n → `automation_tasks` (Bloque 58-61) | Un flujo externo (que el usuario diseña en n8n) encola sugerencias | Fuera de este repo, en la instancia de n8n del usuario |
| **IA Jugador (este módulo)** | **Juega la app localmente, sola, y encola sus propios hallazgos** | `tools/ai-player/` |

Los tres convergen en el mismo lugar: la tabla `automation_tasks` de Supabase,
que ya lee y gestiona la pestaña "🤖 Automatización (n8n)" del Panel de
Administrador (Aprobar ✅ / Descartar ❌ / dejar pendiente). La IA Jugador es
simplemente OTRO `source` posible en esa tabla — no necesitó ningún cambio
en el Panel de Administrador ni en el esquema.

## Qué hace, en una frase

Un script de Node que abre un navegador real (Playwright) contra tu
**servidor de desarrollo local** (nunca producción), le da el control a
Claude a través de un bucle de herramientas (leer la página, hacer clic,
escribir texto, sacar captura, leer errores de consola), y cuando encuentra
algo raro — un bug visual, un error de consola, un flujo que no tiene
sentido — inserta una fila en `automation_tasks` con `status: "pending"`
para que la revises desde el Panel de Administrador, exactamente igual que
si la hubiera mandado n8n.

## Arquitectura

```
tools/ai-player/
├── README.md                    — este archivo
├── package.json                 — 3 dependencias nuevas (primera vez en el repo)
├── .env.example                 — copiar a .env y completar
├── config.js                    — candado de seguridad: solo local, límites de acciones/hallazgos
├── prompts/
│   ├── system.md                — el "quién es" y "cómo juega" de la IA Jugador
│   └── bug-report-schema.md     — qué campos rellena en cada hallazgo, con ejemplos
├── lib/
│   ├── browser.js                — envoltorio de Playwright (navegar, leer, clic, escribir, captura, consola)
│   ├── supabase-writer.js        — inserta filas en automation_tasks (misma clave pública que ya usa la app)
│   └── claude-player.js          — el bucle de agente en sí (Claude API + Tool Runner)
└── player.js                     — punto de entrada por consola
```

## Por qué estas decisiones de diseño

**Playwright, no algo casero.** "Jugar" la app de verdad — clic real,
scroll real, formularios reales — necesita un navegador real controlado por
código, no solo llamadas HTTP. Playwright es el estándar para esto y ya
tiene todo lo necesario: capturas, snapshot de accesibilidad, captura de
errores de consola.

**Herramientas por rol/nombre, no por coordenadas de píxel.** En vez de que
la IA "mire" una captura y adivine dónde hacer clic (el enfoque tipo
"computer use", más caro y más frágil), le doy el snapshot de accesibilidad
de la página (roles + nombres de cada elemento interactivo) y hace clic
por `{role, name}` — exactamente el mismo patrón `read_page` → clic por
referencia que uso yo mismo en este chat para navegar la app durante las
pruebas de cada Bloque. Es más barato, más confiable, y no depende de que
el modelo interprete píxeles correctamente.

**Nunca apunta a producción — candado real, no una convención de nombres.**
`config.js` valida que la URL objetivo sea `localhost`/`127.0.0.1` antes de
lanzar el navegador; si no lo es, el script se niega a arrancar. Esto sigue
el mismo principio ya establecido en `DEPLOYMENT.md`: todo cambio se prueba
en local primero.

**Reutiliza la clave pública de Supabase que ya está en `app.js` — no es un
secreto nuevo.** La tabla `automation_tasks` tiene hoy una política RLS
completamente abierta (ver el aviso de seguridad en `AUTOMATION_WORKFLOW.md`,
Bloque 60) — cualquiera con la clave pública puede escribir ahí, incluida
esta herramienta. El día que esa política se cierre a `ADMIN_EMAIL`
únicamente, esta herramienta necesitará su propia forma de autenticarse
(un usuario de servicio, o volver a abrir el INSERT específicamente para
`source = "ai-player"`) — quedó anotado en `config.js`.

**Cada hallazgo se inserta al momento, no al final de la sesión.** Así, si
la IA Jugador corre 40 minutos y se cae a los 20, los primeros 10 hallazgos
ya están en tu Panel de Administrador — no se pierden.

## Prerrequisitos (nada de esto está hecho todavía)

1. **`npm install`** dentro de esta carpeta (`tools/ai-player/`) — instala
   `@anthropic-ai/sdk`, `@supabase/supabase-js` y `playwright`. Playwright
   además descarga los binarios de Chromium (~300 MB la primera vez) con
   `npx playwright install chromium`.
2. **Una clave de API de Anthropic propia** (`console.anthropic.com`, con
   facturación activa) — esta herramienta corre FUERA de esta sesión de
   Claude Code, así que necesita su propia credencial. Copiar
   `.env.example` a `.env` y completar `ANTHROPIC_API_KEY`.
3. **El servidor de desarrollo local corriendo** (`miikaeru-web/`, el mismo
   que uso yo con `preview_start`) antes de arrancar la IA Jugador.

## Cómo correrla (una vez completos los prerrequisitos)

```bash
cd tools/ai-player
npm install
npx playwright install chromium
cp .env.example .env    # completar ANTHROPIC_API_KEY
node player.js --max-actions 40
```

Flags:
- `--max-actions N` — techo duro de acciones de navegador por sesión (default: 30). Sin esto, un bucle raro del modelo podría correr indefinidamente y gastar de más.
- `--max-findings N` — techo duro de filas que puede insertar en `automation_tasks` por sesión (default: 10) — evita que un bug repetido genere 200 filas idénticas.
- `--dry-run` — corre todo el bucle igual, pero en vez de insertar en Supabase imprime el hallazgo por consola. Para la primera corrida, antes de confiar en que escriba solo a la tabla real.
- `--url <url>` — por default usa `http://localhost:5500` (mismo puerto que uso yo); cambiar si tu servidor local usa otro.

## Costo

Esta herramienta llama a la API de Claude repetidas veces por sesión (una
por cada acción del bucle) — es un gasto real, separado de esta sesión de
Claude Code, y se cobra a la cuenta de Anthropic asociada a
`ANTHROPIC_API_KEY`. `--max-actions` es el control de gasto principal.
`config.js` usa `claude-opus-5` con `effort: "medium"` por default — el
punto de partida razonable para una tarea de exploración/QA, no la más
cara (`xhigh`) ni la más barata (`low`).
