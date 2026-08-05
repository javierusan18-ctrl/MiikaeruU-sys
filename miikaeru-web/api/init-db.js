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
  `create table if not exists public.app_contacts (
    phone text primary key,
    display_name text not null,
    preferred_language text not null default 'es',
    updated_at timestamptz not null default now()
  )`,
  `create table if not exists public.app_friendships (
    id uuid primary key default gen_random_uuid(),
    phone_a text not null references public.app_contacts(phone) on delete cascade,
    phone_b text not null references public.app_contacts(phone) on delete cascade,
    created_at timestamptz not null default now(),
    unique (phone_a, phone_b)
  )`,
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
  `alter table public.app_contacts enable row level security`,
  `alter table public.app_friendships enable row level security`,
  `alter table public.app_friend_messages enable row level security`,
  // DROP + CREATE en vez de "IF NOT EXISTS": CREATE POLICY no acepta esa
  // cláusula en Postgres, así que este es el patrón real para que el
  // statement sea repetible sin tirar "policy already exists" en la
  // segunda corrida. Mismo criterio de RLS ya documentado en app.js
  // para ADMIN_PANEL_PASSWORD/transactions/feedback: sin autenticación
  // real de usuario final en esta app, así que sin RLS por usuario acá
  // tampoco — cualquiera con la anon key (pública) puede leer/escribir.
  `drop policy if exists "anon full access contacts" on public.app_contacts`,
  `create policy "anon full access contacts" on public.app_contacts for all using (true) with check (true)`,
  `drop policy if exists "anon full access friendships" on public.app_friendships`,
  `create policy "anon full access friendships" on public.app_friendships for all using (true) with check (true)`,
  `drop policy if exists "anon full access friend_messages" on public.app_friend_messages`,
  `create policy "anon full access friend_messages" on public.app_friend_messages for all using (true) with check (true)`,
];

async function ensureRealtimeEnabled(client) {
  const { rows } = await client.query(
    `select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_friend_messages'`
  );
  if (rows.length === 0) {
    await client.query(`alter publication supabase_realtime add table public.app_friend_messages`);
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

module.exports = async function handler(req, res) {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    res.status(500).json({
      ok: false,
      error: "Falta SUPABASE_DB_URL en las variables de entorno de Vercel (Project Settings → Environment Variables).",
    });
    return;
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    for (const statement of SCHEMA_STATEMENTS) {
      await client.query(statement);
    }
    await ensureRealtimeEnabled(client);
    await ensureFeedbackAdminPolicies(client);
    res.status(200).json({ ok: true, message: "Tablas de Amigos/Chat y políticas de Admin verificadas/creadas correctamente." });
  } catch (err) {
    console.error("init-db falló:", err);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    await client.end().catch(() => {});
  }
};
