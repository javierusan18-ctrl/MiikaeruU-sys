// Vercel Serverless Function — crea (si no existen) las tablas de
// Amigos/Chat bilingüe directo en Postgres, usando el paquete `pg`.
//
// Por qué `pg` y no supabase-js: el cliente supabase-js (el que ya usa
// el resto de la app, ver SUPABASE_URL/SUPABASE_KEY en app.js) solo
// habla REST vía PostgREST — no expone DDL (CREATE TABLE) por diseño de
// seguridad, sin importar qué tan privilegiada sea la key. La única
// forma real de crear tablas por código es una conexión directa a
// Postgres, que es justo lo que hace este archivo.
//
// Requiere la variable de entorno SUPABASE_DB_URL en Vercel (Project
// Settings → Environment Variables, NUNCA committeada a git) — se saca
// UNA sola vez de Supabase → Settings → Database → Connection string
// (usar el modo "Transaction pooler", puerto 6543, formato
// postgresql://postgres.[ref]:[password]@aws-...pooler.supabase.com:6543/postgres).
// Esa cadena nunca llega al navegador: este archivo corre 100%
// server-side, invocado desde app.js con un simple fetch("/api/init-db")
// que solo recibe un JSON de resultado, nunca la credencial.
//
// Idempotente a propósito — seguro de llamar tantas veces como haga
// falta sin romper nada ni perder datos: cada CREATE TABLE usa
// IF NOT EXISTS; las policies (que Postgres no deja declarar con
// IF NOT EXISTS) se recrean con DROP+CREATE; el alta a la publicación
// de Realtime chequea el catálogo antes de intentar agregar la tabla
// de nuevo.

const { Client } = require("pg");

const SCHEMA_STATEMENTS = [
  // Cuentas de Operador (login real por teléfono+contraseña) — reemplaza
  // el candado local-only anterior (localStorage de un solo dispositivo,
  // ver MASTER_ACCOUNT_KEY en app.js). La contraseña NUNCA se guarda en
  // texto plano acá: se hashea con scrypt del lado del servidor (ver
  // api/_utils.js) antes de llegar a esta tabla.
  //
  // A propósito, esta es la ÚNICA tabla de todo el proyecto SIN política
  // "anon full access" más abajo — RLS habilitado sin ninguna policy
  // significa que la anon key pública (la que vive en app.js, visible en
  // el navegador de cualquiera) no puede leer ni escribir NADA acá, ni
  // siquiera el hash. Los únicos puntos de entrada son las Serverless
  // Functions api/register-account.js, api/login-account.js,
  // api/admin-list-users.js y api/admin-reset-password.js, que usan la
  // conexión directa a Postgres (SUPABASE_DB_URL, ver comentario de
  // cabecera del archivo) y por lo tanto ignoran RLS por completo —
  // mismo mecanismo de privilegio elevado que ya usa el resto de este
  // archivo, solo que acá es la ÚNICA puerta de entrada posible.
  `create table if not exists public.users (
    id uuid default gen_random_uuid() primary key,
    phone text unique not null,
    password text not null,
    name text,
    level integer default 1,
    xp integer default 0,
    streak integer default 0,
    status text default 'active',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
  )`,
  `create table if not exists public.app_contacts (
    phone text primary key,
    display_name text not null,
    preferred_language text not null default 'es',
    updated_at timestamptz not null default now()
  )`,
  // unique_id: ID corto autogenerado ("MKR-892471") además del teléfono
  // y el nombre — pedido explícito para poder buscar/agregar amigos por
  // cualquiera de los tres criterios. Se genera en el cliente
  // (generateUniqueId() en app.js, ver ensureContactRegistered()) y se
  // manda ya armado en el upsert; nullable + unique acá porque Postgres
  // permite múltiples NULL en una columna unique (contactos viejos que
  // todavía no pasaron por el nuevo ensureContactRegistered siguen
  // funcionando sin romper la restricción).
  `alter table public.app_contacts add column if not exists unique_id text unique`,
  `create table if not exists public.app_friendships (
    id uuid primary key default gen_random_uuid(),
    phone_a text not null references public.app_contacts(phone) on delete cascade,
    phone_b text not null references public.app_contacts(phone) on delete cascade,
    created_at timestamptz not null default now(),
    unique (phone_a, phone_b)
  )`,
  // REPLICA IDENTITY FULL — app_friendships es en realidad "sigue a"
  // dirigida (phone_a=quien sigue, phone_b=a quien sigue, ver
  // loadFriends()/addFriendByQuery() en app.js: Siguiendo -> Amigos
  // mutuos cuando existe la fila inversa). wireFriendshipsRealtime()
  // filtra los eventos INSERT/DELETE por `phone_b=eq.<mi teléfono>` para
  // detectar en vivo cuando alguien me sigue de vuelta — sin esto, un
  // evento DELETE solo trae la primary key (id) en su payload, no
  // phone_b, así que el filtro nunca podría machear nada.
  `alter table public.app_friendships replica identity full`,
  `create table if not exists public.app_friend_messages (
    id uuid primary key default gen_random_uuid(),
    phone_from text not null,
    phone_to text not null,
    original_text text not null,
    sender_language text not null default 'es',
    target_language text not null default 'es',
    translated_text text,
    translation_status text not null default 'pending',
    created_at timestamptz not null default now()
  )`,
  // REPLICA IDENTITY FULL — sin esto, un evento Realtime de UPDATE (ver
  // sendFriendMessage(): inserta el mensaje y después hace un UPDATE
  // para sumarle translated_text/translation_status) solo trae en
  // `payload.new` la primary key + las columnas que cambiaron, NO
  // phone_from/phone_to. wireFriendRealtime() en app.js filtra cada
  // evento comparando esos dos campos (friendConversationMatches) — sin
  // ellos, la traducción que llega por UPDATE nunca hace match y el
  // destinatario se queda viendo el mensaje sin traducir hasta refrescar
  // a mano. Idempotente: fijar el modo dos veces no rompe nada.
  `alter table public.app_friend_messages replica identity full`,
  // player_progress: respaldo en la nube del Nivel/XP/Oro/Diamantes/
  // Racha de cada operador (antes solo vivían en localStorage, ver
  // state en app.js) — necesario para que el nuevo Panel de
  // Administrador → "👥 Usuarios" pueda listar y editar operadores desde
  // cualquier dispositivo. `profile_id` (activeProfileId en app.js) es
  // la clave, no `phone`: un mismo teléfono de Cuenta Principal puede
  // tener varios Sub-Perfiles en el mismo dispositivo (ver
  // syncTransactionToSupabase(), que ya usa este mismo criterio).
  `create table if not exists public.player_progress (
    profile_id text primary key,
    operator_name text,
    phone text,
    level integer not null default 1,
    xp integer not null default 0,
    xp_to_next integer not null default 100,
    gold integer not null default 0,
    diamonds integer not null default 0,
    streak integer not null default 0,
    last_active_date text,
    updated_at timestamptz not null default now()
  )`,
  // hero_avatars: respaldo en la nube de las URLs de foto que el
  // SUPER_ADMIN carga desde el Panel de Administrador → "📸 Fotos" para
  // cada personaje del Héroe (Fesha/Mijashi/Miikaeru, ver
  // HERO_AVATAR_OPTIONS en app.js). localStorage sigue siendo la fuente
  // de verdad LOCAL (instantánea en Onboarding/#hero-modal/Header, ver
  // heroAvatarSrc() en app.js) — esta tabla es best-effort para que la
  // URL elegida también llegue a otros dispositivos. `character_id` es
  // la clave ("fesha" | "mijashi" | "miikaeru").
  `create table if not exists public.hero_avatars (
    character_id text primary key,
    image_url text not null,
    updated_at timestamptz not null default now()
  )`,
  // Escuadrones (Squads) — mismo criterio "quien conoce el código entra"
  // que Amigos (identidad = phone de la Cuenta Principal, sin Supabase
  // Auth de usuario final). `code` es el código corto compartible
  // ("A7K2P9", ver generateSquadCode() en app.js) para unirse sin
  // invitación previa. on delete cascade en members/messages: si un
  // escuadrón se borra, sus filas dependientes se van con él.
  `create table if not exists public.app_squads (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    owner_phone text not null,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists public.app_squad_members (
    squad_id uuid not null references public.app_squads(id) on delete cascade,
    phone text not null,
    joined_at timestamptz not null default now(),
    primary key (squad_id, phone)
  )`,
  `create table if not exists public.app_squad_messages (
    id uuid primary key default gen_random_uuid(),
    squad_id uuid not null references public.app_squads(id) on delete cascade,
    phone_from text not null,
    display_name text not null,
    text text not null,
    created_at timestamptz not null default now()
  )`,
  // Sin política "anon full access" para esta — ver el comentario junto
  // al CREATE TABLE de public.users más arriba, es intencional.
  `alter table public.users enable row level security`,
  `alter table public.app_contacts enable row level security`,
  `alter table public.app_friendships enable row level security`,
  `alter table public.app_friend_messages enable row level security`,
  `alter table public.player_progress enable row level security`,
  `alter table public.hero_avatars enable row level security`,
  `alter table public.app_squads enable row level security`,
  `alter table public.app_squad_members enable row level security`,
  `alter table public.app_squad_messages enable row level security`,
  // DROP + CREATE en vez de "IF NOT EXISTS": CREATE POLICY no acepta esa
  // cláusula en Postgres, así que este es el patrón real para que el
  // statement sea repetible sin tirar "policy already exists" en la
  // segunda corrida. Mismo criterio de RLS ya documentado en app.js
  // para ADMIN_PANEL_PASSWORD/transactions/feedback: sin autenticación
  // real de usuario final en esta app, así que sin RLS por usuario acá
  // tampoco — cualquiera con la anon key (pública) puede leer/escribir.
  // player_progress sigue el mismo criterio que transactions (no el de
  // feedback, que sí exige auth real): cada dispositivo necesita poder
  // escribir SU PROPIO progreso vía la anon key sin sesión de Supabase
  // Auth, así que no hay forma de restringir la escritura por RLS sin
  // autenticación real de usuario final (que esta app no tiene) — la
  // protección de la vista de edición del admin es 100% del lado de la
  // interfaz (isSuperAdmin), documentado igual que en el resto del
  // Panel de Administrador.
  `drop policy if exists "anon full access contacts" on public.app_contacts`,
  `create policy "anon full access contacts" on public.app_contacts for all using (true) with check (true)`,
  `drop policy if exists "anon full access friendships" on public.app_friendships`,
  `create policy "anon full access friendships" on public.app_friendships for all using (true) with check (true)`,
  `drop policy if exists "anon full access friend_messages" on public.app_friend_messages`,
  `create policy "anon full access friend_messages" on public.app_friend_messages for all using (true) with check (true)`,
  `drop policy if exists "anon full access player_progress" on public.player_progress`,
  `create policy "anon full access player_progress" on public.player_progress for all using (true) with check (true)`,
  `drop policy if exists "anon full access hero_avatars" on public.hero_avatars`,
  `create policy "anon full access hero_avatars" on public.hero_avatars for all using (true) with check (true)`,
  `drop policy if exists "anon full access squads" on public.app_squads`,
  `create policy "anon full access squads" on public.app_squads for all using (true) with check (true)`,
  `drop policy if exists "anon full access squad_members" on public.app_squad_members`,
  `create policy "anon full access squad_members" on public.app_squad_members for all using (true) with check (true)`,
  `drop policy if exists "anon full access squad_messages" on public.app_squad_messages`,
  `create policy "anon full access squad_messages" on public.app_squad_messages for all using (true) with check (true)`,
];

async function ensureRealtimeEnabled(client, tableName) {
  const { rows } = await client.query(
    `select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = $1`,
    [tableName]
  );
  if (rows.length === 0) {
    await client.query(`alter publication supabase_realtime add table public.${tableName}`);
  }
}

// Debe coincidir EXACTAMENTE con ADMIN_EMAIL en app.js — ver
// checkAdminSession()/el submit de #admin-login-form ahí. Ese archivo
// exige además que este email sea el de una sesión de Supabase Auth
// real y válida (Authentication → Users en el Dashboard de Supabase);
// esta constante por sí sola no le da a nadie acceso, solo le abre la
// puerta de la política RLS al email que YA logró loguearse de verdad.
const ADMIN_EMAIL = "javierusan18@gmail.com";

// Políticas de admin para `feedback` (Bugs & Sugerencias, Bloque 35) —
// antes se pedía correrlas a mano en el SQL Editor de Supabase (ver
// PROGRESS_LOG Bloque 37); se migran acá al mismo mecanismo automático
// que las tablas de Amigos/Chat, por el mismo pedido explícito del
// usuario de no tener que tocar el panel de Supabase a mano. DROP+CREATE
// por el mismo motivo que las policies de arriba: CREATE POLICY no
// admite IF NOT EXISTS, así es como se hace idempotente.
//
// Chequea que la tabla exista ANTES de tocarla (a diferencia de las de
// Amigos/Chat, esta no la crea este archivo — la creó el usuario a mano
// en el Bloque 35) para no romper el resto del init si por lo que sea
// todavía no existe en este proyecto de Supabase.
async function ensureFeedbackAdminPolicies(client) {
  const { rows } = await client.query(
    `select 1 from information_schema.tables where table_schema = 'public' and table_name = 'feedback'`
  );
  if (rows.length === 0) return;

  await client.query(`alter table public.feedback add column if not exists status text not null default 'pendiente'`);

  await client.query(`drop policy if exists "admin can read feedback" on public.feedback`);
  await client.query(
    `create policy "admin can read feedback" on public.feedback
       for select to authenticated
       using (auth.jwt() ->> 'email' = '${ADMIN_EMAIL}')`
  );

  await client.query(`drop policy if exists "admin can update feedback" on public.feedback`);
  await client.query(
    `create policy "admin can update feedback" on public.feedback
       for update to authenticated
       using (auth.jwt() ->> 'email' = '${ADMIN_EMAIL}')
       with check (auth.jwt() ->> 'email' = '${ADMIN_EMAIL}')`
  );
}

// Corre UN statement aislado del resto — a propósito, en vez del
// for-loop original que hacía `await client.query(statement)` directo:
// ahí, un solo statement que fallara (choque de nombre, permiso, lo que
// sea) abortaba el `try` entero y ninguno de los statements SIGUIENTES
// llegaba a correr — ni siquiera los de tablas totalmente independientes
// (ej.: si `app_squads` fallaba por lo que sea, ni sus políticas ni las
// de Amigos que venían después se volvían a aplicar). Aislar cada
// statement es lo que de verdad soluciona "la creación de squads debe
// registrarse correctamente": ahora un problema puntual en una tabla no
// puede dejar a las demás sin sus políticas/columnas.
async function runStatement(client, statement) {
  try {
    await client.query(statement);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = async function handler(req, res) {
  const connectionString = (process.env.SUPABASE_DB_URL || "").trim();
  if (!connectionString) {
    res.status(500).json({
      ok: false,
      error: "Falta SUPABASE_DB_URL en las variables de entorno de Vercel (Project Settings → Environment Variables).",
      howToFix:
        "Supabase → Settings → Database → Connection string (modo 'Transaction pooler', puerto 6543) → copiar → Vercel → Project Settings → Environment Variables → agregar SUPABASE_DB_URL → redeploy.",
    });
    return;
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  const failedStatements = [];
  const realtimeErrors = [];

  try {
    await client.connect();

    for (const statement of SCHEMA_STATEMENTS) {
      const result = await runStatement(client, statement);
      if (!result.ok) {
        failedStatements.push({ statement: statement.trim().replace(/\s+/g, " ").slice(0, 100), error: result.error });
      }
    }

    for (const table of ["app_friendships", "app_friend_messages", "app_squad_messages", "player_progress"]) {
      try {
        await ensureRealtimeEnabled(client, table);
      } catch (err) {
        realtimeErrors.push({ table, error: err.message });
      }
    }

    try {
      await ensureFeedbackAdminPolicies(client);
    } catch (err) {
      failedStatements.push({ statement: "ensureFeedbackAdminPolicies", error: err.message });
    }

    const ok = failedStatements.length === 0 && realtimeErrors.length === 0;
    res.status(ok ? 200 : 207).json({
      ok,
      message: ok
        ? "Tablas de Amigos/Chat/Escuadrones y políticas de Admin verificadas/creadas correctamente."
        : `Se aplicó lo que se pudo — ${failedStatements.length} statement(s) y ${realtimeErrors.length} tabla(s) de Realtime fallaron, ver detalle.`,
      failedStatements,
      realtimeErrors,
    });
  } catch (err) {
    // Solo llega acá un fallo de conexión (credencial mala, red, etc.) —
    // los fallos de statements individuales ya no burbujean hasta acá.
    console.error("init-db falló al conectar:", err);
    res.status(500).json({ ok: false, error: err.message, failedStatements });
  } finally {
    await client.end().catch(() => {});
  }
};
