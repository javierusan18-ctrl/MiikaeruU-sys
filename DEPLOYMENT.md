# Despliegue a producción — Bloque 61

## Estado (2026-08-01): el workflow está en el repo, pero **NO tiene efecto todavía**

Hasta que se complete el Paso 1 de abajo (un cambio manual en el dashboard
de Vercel, algo a lo que Claude Code no tiene acceso), Vercel sigue
desplegando `main` automáticamente en cada push — exactamente el
comportamiento de siempre. Este documento existe para que ese Paso 1 quede
claro y no se pierda.

## Qué cambia y por qué

Hasta el Bloque 60, `main` era a la vez "donde se trabaja" y "lo que ve el
usuario en producción" — cada `git push origin main` salía en vivo en
`miikaeru-web.vercel.app` en segundos (política explícita, ver memoria
`feedback_autopush_policy`). El usuario pidió separar esas dos cosas: poder
seguir trabajando/probando en local sin que cada cambio golpee a los
usuarios activos, con un despliegue controlado los viernes 8PM (hora de
Perú) o a demanda con un botón.

**Modelo nuevo de dos ramas:**

| Rama | Qué es | Quién le hace push |
|---|---|---|
| `main` | Donde se trabaja y se prueba en local todos los días. NUNCA se despliega sola. | Claude Code / el usuario, cuando quieran, sin restricción — como siempre. |
| `production` | Lo que Vercel realmente despliega. | SOLO [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — nadie le hace push a mano. |

`deploy.yml` toma el estado actual de `main` y lo copia a `production`,
automáticamente cada viernes 20:00 hora de Perú (sábado 01:00 UTC), o
cuando alguien lo dispare a mano (ver Paso 3).

## Paso 1 (manual, una sola vez, en el dashboard de Vercel)

1. Entrar al proyecto `miikaeru-web` en [vercel.com](https://vercel.com/dashboard).
2. **Settings → Git**.
3. Cambiar **Production Branch** de `main` a `production`.
4. Guardar.

Antes de este paso, la rama `production` puede no existir todavía en
GitHub — se crea sola la primera vez que corra `deploy.yml` (manual o
programado). Se puede hacer este Paso 1 antes o después de esa primera
corrida, no importa el orden.

## Paso 2: confirmar que quedó bien

Después del Paso 1 y de la primera corrida de `deploy.yml`:
- `git push origin main` (o que Claude Code lo haga) → Vercel **NO** debería generar un deploy nuevo.
- Correr el workflow a mano (Paso 3) → Vercel **SÍ** debería generar un deploy nuevo, con el contenido más reciente de `main`.

Avisar a Claude Code cuando esto esté confirmado — recién ahí se actualiza
la memoria de sesión (`feedback_autopush_policy`) para reflejar que
`git push origin main` ya no implica "esto ya está en producción".

## Paso 3: disparar un despliegue manual (antes del viernes)

Dos formas, ambas hacen exactamente lo mismo que la corrida automática del
viernes:

**Desde la web de GitHub:**
1. Pestaña **Actions** del repo.
2. Workflow **"Deploy to production"** (columna izquierda).
3. Botón **"Run workflow"** → rama `main` → **"Run workflow"**.

**Desde la terminal** (requiere [GitHub CLI](https://cli.github.com/), `gh auth login` una sola vez):

```bash
gh workflow run deploy.yml
```

## Protección de datos / usuarios activos

- El despliegue en sí (HTML/CSS/JS estáticos) no toca ninguna base de
  datos — separar `main`/`production` no cambia nada de cómo funciona
  Supabase, solo controla CUÁNDO el código nuevo llega a los usuarios.
- Los cambios de esquema de base de datos (tablas, columnas, políticas
  RLS) se versionan aparte, en [`supabase/migrations/`](supabase/migrations/README.md)
  — ver ese README para la convención. Siguen sin aplicarse solos: se
  corren a mano en el SQL Editor de Supabase, con el archivo `.sql` como
  registro de qué se corrió.
- Nada de esto reemplaza tener cuidado real al escribir una migración
  (agregar una columna `not null` sin default sobre una tabla con filas
  reales sigue siendo peligroso sin importar en qué rama esté el código
  que la acompaña) — lo que agrega es que ese SQL quede escrito y
  revisable ANTES de correrlo, en vez de perderse en el historial del
  SQL Editor.

## Seguridad de Amigos/Chat/Escuadrones — JWT de Operador (2026-09-28)

Las tablas `app_contacts`, `app_friendships`, `app_friend_messages`,
`app_squads`, `app_squad_members` y `app_squad_messages` ya no tienen
políticas "anon full access": solo se accede con un JWT de Operador que
emiten `/api/login-account` y `/api/register-account` (claim `op_phone`,
ver `signOperatorToken()` en `api/_utils.js`), y las políticas RLS de
`ensureSocialPolicies` en `api/init-db.js` filtran por ese claim.

Orden obligatorio al desplegar (si no, Amigos/Escuadrones quedan
bloqueados para todos hasta completar los pasos):

1. Supabase → Project Settings → JWT Keys → copiar el **Legacy JWT secret**
   (HS256). Si el proyecto ya migró a claves asimétricas, el secreto
   legacy sigue sirviendo mientras no esté revocado.
2. Vercel → Project Settings → Environment Variables → agregar
   `SUPABASE_JWT_SECRET` con ese valor (Production + Preview). Nunca
   commitearlo.
3. Desplegar y abrir `/api/init-db` una vez (o dejar que la app lo llame
   sola — el flag `DB_INIT_FLAG_KEY` se subió para eso). Debe responder
   `ok: true`.
4. Cada Operador que ya tenía la sesión recordada tiene que cerrar sesión
   y volver a entrar UNA vez para obtener su token (la app se lo indica en
   las pestañas Amigos/Escuadrón).
