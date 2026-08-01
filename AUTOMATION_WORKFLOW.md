# Automation Workflow — Cola de Mejoras y Bugfixes Aprobados

Este documento define el contrato de datos entre una futura integración de
**n8n** (orquestando, por ejemplo, un agente de Gemini que propone cambios)
y el backlog local de este proyecto: [`approved_tasks.json`](approved_tasks.json).

**Estado actual (2026-07-31): no existe ninguna llamada real a n8n en el
código.** Este archivo prepara el terreno — define cómo *debería* verse el
JSON que n8n enviaría el día que esa integración se construya — pero hoy
`approved_tasks.json` es una cola vacía que se llena y se consume a mano
(por un humano, o por Claude Code en una sesión de trabajo). No hay ningún
webhook, endpoint ni polling escuchando en la app.

## Actualización (Bloque 58, 2026-08-01): segundo canal, vía Supabase, para la app en vivo

Todo lo de arriba sigue siendo cierto para el canal **local** (código/
desarrollo). Pero además existe ahora un segundo canal, pensado para que un
flujo de n8n corriendo en la máquina del usuario (puerto 5678, contenedor
Docker `n8n-flujo-metatron`) sincronice datos **con la PWA ya publicada en
Vercel**, sin que eso implique tocar código ni hacer un redeploy:

- Tabla nueva en Supabase: **`automation_tasks`** — mismo esquema de campos
  que `approved_tasks.json` (ver más abajo), para que el contrato sea
  idéntico sin importar qué canal se use.
- n8n escribe ahí **directo, vía la API REST de Supabase** (con la
  `service_role key`, que salta las políticas RLS) — no hay ningún webhook
  ni endpoint expuesto por este código que n8n tenga que llamar. Sigue
  siendo cierto que "no existe ninguna llamada real a n8n en el código":
  la sincronización pasa por Supabase, no por la PWA.
- La PWA **lee** esa tabla desde una pestaña nueva "🤖 Automatización (n8n)"
  dentro del Panel de Administrador (mismo lugar que el Agente Inspector),
  visible solo para `ADMIN_EMAIL` — mismo candado que ya protege
  Transacciones e Inspector de Bugs.
- **Tiempo real de verdad**: la pestaña abre una suscripción de Supabase
  Realtime (`supabaseClient.channel(...).on("postgres_changes", ...)`)
  sobre `automation_tasks` — una fila que n8n inserte aparece en la lista
  sin que el admin tenga que tocar "Actualizar" ni recargar la página.
- Un admin puede marcar cada tarea `pending` como `completed` o `failed`
  (con una nota opcional) directamente desde esa pestaña — mismo ciclo de
  vida `pending → completed`/`failed` documentado abajo para el canal
  local, mismos nombres de estado.

**SQL que el usuario efectivamente corrió (versión simplificada de la
propuesta original de arriba — esto es lo que existe hoy en Supabase, no
se guarda como archivo `.sql` en este repo):**

```sql
create table if not exists public.automation_tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  status text not null default 'pending',
  payload jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.automation_tasks enable row level security;

create policy "Permitir todo a service_role y acceso general" on public.automation_tasks
  for all using (true) with check (true);

alter publication supabase_realtime add table public.automation_tasks;
```

Diferencia real con la propuesta original: en vez de columnas separadas
(`description`/`type`/`priority`/`affected_files`/`source`/`notes`), todo
eso vive adentro de `payload` (jsonb) como un objeto suelto — el código de
`app.js` (`renderAutomationCards()`/`updateAutomationTaskStatus()`) ya se
adaptó a leer de ahí (`payload.description`, `payload.type`, etc., todos
opcionales) en vez de columnas propias.

**⚠️ Nota de seguridad, sin resolver a propósito — decisión que le
corresponde al usuario, no algo que este código vaya a cambiar solo:**
la política `for all using (true) with check (true)` deja la tabla
completamente abierta a través de la **clave pública ("publishable
key") de Supabase, que vive embebida en el JS del lado del cliente** (ver
`initSupabaseClient()` en `app.js`) — es decir, cualquier visitante del
sitio (no solo `ADMIN_EMAIL`, ni siquiera alguien logueado) puede leer,
insertar, modificar o borrar filas de `automation_tasks` llamando directo
a la API REST de Supabase, sin pasar por la UI del Panel de Administrador
en absoluto (el candado `isSuperAdmin` de la pestaña es solo un filtro de
interfaz, no control de acceso real). Esto es distinto de CUALQUIER otra
tabla que ya usa este proyecto (`feedback`, `transactions`), que
restringen lectura/escritura a `auth.jwt() ->> 'email' = 'admin@miikaeru.com'`.

Si en algún momento se quiere cerrar esto sin tocar código (la pestaña ya
lee/escribe igual con cualquiera de las dos políticas), reemplazar la
política de arriba por:

```sql
drop policy "Permitir todo a service_role y acceso general" on public.automation_tasks;

create policy "automation_tasks_select_admin"
  on public.automation_tasks for select
  using (auth.jwt() ->> 'email' = 'admin@miikaeru.com');

create policy "automation_tasks_update_admin"
  on public.automation_tasks for update
  using (auth.jwt() ->> 'email' = 'admin@miikaeru.com');

-- n8n sigue pudiendo insertar igual: su service_role key ignora RLS
-- por completo, no necesita ninguna política de INSERT a su nombre.
```

**Qué NO cambia:** `approved_tasks.json`/`tools/run_next_task.js` (el canal
local, para desarrollo/código) siguen existiendo tal cual, sin tocar — son
un flujo distinto y complementario, no reemplazado por este.

## Actualización (Bloque 63, 2026-08-01): tercer origen — IA Jugador (`source: "ai-player"`)

Un tercer productor de filas en `automation_tasks`, además de n8n y de un
humano completando el formulario a mano: [`tools/ai-player/`](tools/ai-player/README.md),
un script de Node que abre un navegador real (Playwright) contra el
servidor de desarrollo **local**, le da el control a Claude (vía el Tool
Runner del SDK oficial) para que juegue la app como un usuario nuevo, y
cuando encuentra un bug visual/de lógica/de rendimiento lo inserta él mismo
en `automation_tasks` con `payload.source: "ai-player"` — mismo esquema
exacto documentado arriba, sin ningún cambio de tabla ni de RLS.

No agrega ningún canal nuevo hacia esta app ni hacia Supabase: reutiliza la
misma tabla, el mismo esquema (`payload.description`/`type`/`priority`/
`source`/`affected_files`/`notes`), y la misma clave pública que ya usa
`miikaeru-web/app.js`. Ver [`tools/ai-player/README.md`](tools/ai-player/README.md)
para la arquitectura completa, y [`tools/ai-player/prompts/`](tools/ai-player/prompts/)
para el comportamiento exacto y el criterio de qué reporta.

**Candado de seguridad real, no una convención:** `tools/ai-player/config.js`
se niega a arrancar si la URL objetivo no es `localhost`/`127.0.0.1` —
la IA Jugador nunca "juega" contra producción, aunque escriba en la misma
Supabase (es intencional: así los hallazgos llegan al Panel de
Administrador real).

## Por qué vive fuera de `miikaeru-web/`

`approved_tasks.json` y este documento están en la **raíz** del proyecto
(`Miikaeru_MVP/`), no dentro de `miikaeru-web/` (la carpeta que se
deploya). Es información interna de gestión del proyecto — rutas de
archivos del repo, descripciones de bugs internos — que no debe quedar
públicamente accesible en `https://miikaeru-web.vercel.app/approved_tasks.json`
si algún día se sirve todo el contenido de esa carpeta tal cual.

## Esquema de una tarea

Cada elemento del array `tasks` en `approved_tasks.json` sigue este
esquema:

```json
{
  "id": "AT-0001",
  "title": "Título corto en imperativo",
  "description": "Descripción completa y ACCIONABLE del bugfix o mejora — suficiente para que un humano o Claude Code la ejecute sin tener que adivinar el alcance real.",
  "type": "bugfix",
  "affectedFiles": [
    "miikaeru-web/app.js",
    "miikaeru-web/style.css"
  ],
  "priority": "medium",
  "status": "pending",
  "source": "manual",
  "createdAt": "2026-07-31T00:00:00.000Z",
  "completedAt": null,
  "notes": null
}
```

| Campo | Tipo | Valores / notas |
|---|---|---|
| `id` | string | Único, formato `AT-####` (Approved Task). Nunca se reutiliza. |
| `title` | string | Resumen corto, en imperativo (≤ 60 caracteres aprox.). |
| `description` | string | El detalle real — qué cambiar y por qué. Debe ser específico: "arreglar el botón" no alcanza, "el botón #jpVocabQuizStartBtn no dispara el evento click en iOS Safari porque..." sí. |
| `type` | string | `"bugfix"` \| `"feature"` \| `"improvement"` |
| `affectedFiles` | string[] | Rutas relativas al root del repo (`miikaeru-web/app.js`, no rutas absolutas de disco). Ayuda a acotar el blast radius antes de tocar nada. |
| `priority` | string | `"low"` \| `"medium"` \| `"high"` |
| `status` | string | `"pending"` \| `"completed"` \| `"failed"`. Ver ciclo de vida abajo. |
| `source` | string | Quién encoló la tarea: `"manual"`, `"n8n"`, `"gemini"`. |
| `createdAt` | string | ISO 8601 UTC. |
| `completedAt` | string \| null | ISO 8601 UTC, o `null` mientras siga `pending`. |
| `notes` | string \| null | Resultado de la ejecución (qué se hizo, o por qué falló) — se llena al pasar a `completed`/`failed`, no antes. |

## Ciclo de vida de una tarea

```
pending  →  completed
   └────→  failed
```

No hay estado `in_progress` a propósito: mientras no exista un ejecutor
automático (ver más abajo), una tarea está `pending` hasta que alguien la
toma y la termina en la misma sesión — no hace falta un tercer estado para
trabajo a medio hacer que hoy no existe.

## Contrato para n8n/Gemini (cuando exista esa integración)

Si en el futuro n8n encola tareas automáticamente (por ejemplo, un agente
de Gemini que analiza feedback de usuarios — ver el módulo "Inspector
Agent" en `app.js`, que ya lee la tabla `feedback` de Supabase — y propone
fixes), el JSON que agregue a `tasks` en `approved_tasks.json` debe:

1. Cumplir el esquema de arriba exactamente (mismos campos, mismos tipos).
2. Traer `status: "pending"` y `source: "n8n"` (o `"gemini"` si el JSON
   viene directo del modelo antes de pasar por el flujo de n8n).
3. Traer `affectedFiles` con rutas reales del repo — no inventadas. Un
   ejecutor (automático o humano) necesita saber qué tocar sin tener que
   adivinar.
4. Traer una `description` completa y autocontenida — sin asumir contexto
   de una conversación que el ejecutor no vio (mismo criterio que exigimos
   para prompts de subagentes en este proyecto: "no delegar el
   entendimiento").
5. Nunca escribir directo `status: "completed"` — eso lo decide quien
   ejecuta la tarea, no quien la propone.

## Ejecución de la cola (estado actual)

[`tools/run_next_task.js`](tools/run_next_task.js) es un **lector/selector**
de la cola — NO aplica ningún cambio de código por su cuenta:

```bash
node tools/run_next_task.js               # muestra la próxima tarea pending (por prioridad, luego antigüedad)
node tools/run_next_task.js --list        # lista todas las tareas con su status
node tools/run_next_task.js --complete AT-0001 "qué se hizo"   # marca completed
node tools/run_next_task.js --fail AT-0001 "por qué falló"     # marca failed
```

El flujo real hoy es: correr el script, tomar la tarea que señala como
"siguiente", pedirle a un humano o a una sesión de Claude Code que la
ejecute igual que cualquier otro pedido de trabajo sobre el repo, y recién
ahí correr `--complete`/`--fail` a mano. El script solo toca
`approved_tasks.json` — nunca `app.js`, `style.css` ni ningún otro archivo
del proyecto.

La razón de no automatizar la ejecución del cambio de código en sí, ver el
punto siguiente.

### Por qué NO hay un ejecutor automático todavía

Este proyecto (`Miikaeru_MVP`) **no tiene repositorio git inicializado**
(confirmado — no existe carpeta `.git/`). Sin control de versiones, un
script que aplique modificaciones de código de forma desatendida sobre
`miikaeru-web/app.js` (un único archivo de ~10,000 líneas donde vive casi
toda la lógica de la app) no tiene ninguna red de seguridad: un cambio
automático malo no se puede revertir con `git diff`/`git checkout`, se
pierde el estado anterior sin más. Construir ese ejecutor a ciegas sería
exactamente el tipo de automatización que este mismo pedido dice querer
evitar ("sin romper nada de la lógica actual").

Antes de construir el ejecutor automático hace falta decidir, como mínimo:

- Inicializar git (para poder revertir cualquier tarea aplicada automáticamente).
- El formato real de "modificación" que trae cada tarea (¿un diff unificado? ¿instrucciones en lenguaje natural que un agente interpreta, como el `description` de arriba? ¿un patch estructurado tipo `old_string`/`new_string`?).
- Un modo `--dry-run` que muestre el cambio propuesto sin aplicarlo.
- Un límite real de cuántas tareas se aplican por corrida (lo que el pedido original llama "límites de rendimiento para evitar saturar la PWA").

Ese diseño queda pendiente de una decisión explícita — ver la pregunta
que se le hizo al usuario en la sesión donde se creó este documento.
