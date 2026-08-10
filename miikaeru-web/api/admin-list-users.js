// Vercel Serverless Function — lista todas las Cuentas de Operador
// (public.users) para la pestaña "👥 Usuarios" del Panel de
// Administrador. Solo responde si el caller manda un token Bearer de
// una sesión REAL de Supabase Auth cuyo email es exactamente ADMIN_EMAIL
// (ver verifyAdminToken() en api/_utils.js) — corre con la conexión
// directa a Postgres (SUPABASE_DB_URL), así que es el único camino
// posible para leer esta tabla (no tiene política RLS para la anon key,
// ver init-db.js).
//
// El SELECT nunca pide la columna `password` — ni siquiera el Admin
// llega a verla, ni como hash: solo existe la opción de "Restablecer
// Contraseña" (ver admin-reset-password.js), nunca "leerla".
//
// LEFT JOIN LATERAL contra la fila MÁS RECIENTE de player_progress por
// teléfono: ese es el dato que el propio juego ya sincroniza en vivo
// (ver syncPlayerProgressToSupabase() en app.js) cada vez que el
// Operador sube de nivel/XP/racha — reutilizarlo acá evita tener dos
// fuentes de verdad para lo mismo (users.level/xp/streak quedan en su
// valor por default hasta que exista al menos un player_progress real
// para ese teléfono). También se trae `profile_id` para que el botón
// "✏️ Editar" del Admin (que sigue editando player_progress, sin
// cambios) sepa a qué fila apuntar.

const { Client } = require("pg");
const { verifyAdminToken, getSupabaseEnvDiagnostics } = require("./_utils");

module.exports = async function handler(req, res) {
  const isAdmin = await verifyAdminToken(req.headers.authorization);
  if (!isAdmin) {
    res.status(401).json({ ok: false, error: "not_authorized" });
    return;
  }

  const connectionString = (process.env.SUPABASE_DB_URL || "").trim();
  if (!connectionString) {
    // `error` como código corto (no la frase en español) — mismo criterio
    // que admin-metrics.js, así el frontend puede clasificar el mensaje
    // en vez de mostrar siempre el genérico "Error de red" para
    // cualquier fallo (ver metricsErrorMessage()/fetchUsersAccounts() en
    // app.js).
    res.status(500).json({
      ok: false,
      error: "missing_env",
      detail: "Falta SUPABASE_DB_URL en las variables de entorno de Vercel.",
      diagnostics: getSupabaseEnvDiagnostics(),
    });
    return;
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();

    const { rows } = await client.query(`
      select
        u.id,
        u.phone,
        u.name as operator_name,
        u.status,
        u.created_at,
        coalesce(pp.level, u.level) as level,
        coalesce(pp.xp, u.xp) as xp,
        pp.xp_to_next,
        coalesce(pp.streak, u.streak) as streak,
        pp.last_active_date,
        pp.profile_id
      from public.users u
      left join lateral (
        select level, xp, xp_to_next, streak, last_active_date, profile_id
        from public.player_progress
        where phone = u.phone
        order by updated_at desc
        limit 1
      ) pp on true
      order by u.created_at desc
    `);

    res.status(200).json({ ok: true, users: rows });
  } catch (err) {
    console.error("admin-list-users falló:", err);
    // 42P01 = "undefined_table" en Postgres — significa que /api/init-db
    // todavía no corrió después de este cambio (o corrió antes de que
    // existiera esta tabla). Se distingue para que el Admin vea un aviso
    // claro en vez de un error crudo de servidor.
    if (err.code === "42P01") {
      res.status(200).json({ ok: false, error: "table_missing" });
      return;
    }
    res.status(500).json({ ok: false, error: "server_error" });
  } finally {
    await client.end().catch(() => {});
  }
};
