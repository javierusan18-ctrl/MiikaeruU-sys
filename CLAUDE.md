# CLAUDE.md — Miikaeru MVP

Reglas para Claude Code en este repositorio. Tienen prioridad sobre cualquier prompt.

## 1. Regla de oro: trabajar SOLO sobre la base existente
- **Prohibido crear la app (o módulos completos) desde cero.** Todo cambio es una edición
  incremental de archivos que ya existen. Antes de editar, lee el archivo y sigue su estilo.
- **Prohibido buscar, clonar o copiar repositorios externos** (GitHub, plantillas, boilerplates,
  `npx create-*`, `git clone`). No uses WebSearch/WebFetch para traer código.
- **Prohibido agregar dependencias nuevas** (`npm install <pkg>`) sin que Javier lo pida explícitamente.
- Un archivo nuevo solo se permite si: lo pide Javier, o es la pieza mínima que no cabe en
  un archivo existente (ej. una función en `miikaeru-web/api/`). Dilo antes de crearlo.
- Si una tarea parece exigir reescribir algo grande: **para y pregunta**, propone el cambio mínimo.

## 2. Reparto de trabajo
- **Javier decide**: dirección del producto, lógica core (identidad, roles admin/operador,
  pagos, datos de usuarios), y qué se publica.
- **Claude ejecuta**: el trabajo pesado (refactors mecánicos, búsquedas, migraciones SQL
  redactadas, scripts, revisión, pruebas, commits).
- Si un cambio toca la lógica core, muestra el diff propuesto y espera un "sí" antes de aplicarlo.
- Sesiones desde el celular: respuestas cortas, un resumen final de 3–5 líneas,
  nada de bloques de código largos salvo que se pidan.

## 3. Estructura (no la cambies)
- `miikaeru-web/` — PWA estática, HTML/CSS/JS puro, **sin build step**. Raíz del deploy en Vercel.
  - `index.html`, `app.js`, `style.css`, `sw.js` — núcleo de la app.
  - `api/` — Serverless Functions de Vercel (dependencia: `pg`).
  - `dashboard/`, `mapa-mental/`, `data/`, `assets/` — módulos existentes.
- `supabase/` — SQL / migraciones. `tools/` — scripts auxiliares.
- `PROGRESS_LOG.md` — bitácora por bloques. Agrega una entrada al terminar cada bloque.
- `DEPLOYMENT.md`, `AUTOMATION_WORKFLOW.md`, `approved_tasks.json` — leer antes de tocar deploy/automatización.

## 4. Reglas de deploy que ya costaron bugs
- En cada cambio real de `app.js` o `style.css`: **subir el `?v=` en `index.html` Y el
  `CACHE_NAME` en `sw.js`**. Si no, los usuarios que vuelven ven la versión vieja.
- Operador (teléfono) y Admin (email Supabase Auth, tabla `public.admins`) son identidades
  separadas. No mezclarlas. Nunca reintroducir la capa de Sub-Perfil a nivel dispositivo.
- Nunca imprimir, commitear ni mover `.env.local` ni claves `service_role`.

## 5. Git
- Otros chats editan este repo a la vez: **nunca `git add -A` / `git add .`**; agrega solo tus archivos.
- Mensajes de commit en español, describiendo el porqué.
- Sin tests automáticos: verifica abriendo la página afectada antes de dar algo por hecho.
