// Vercel Serverless Function — métricas rápidas para una futura pestaña
// "📊 Métricas" del Panel de Administrador. Mismo criterio de acceso que
// admin-list-users.js: solo responde si el caller manda un token Bearer
// de una sesión REAL de Supabase Auth cuyo email es ADMIN_EMAIL (ver
// verifyAdminToken() en api/_utils.js), y corre con la conexión directa
// a Postgres (SUPABASE_DB_URL) porque public.users no tiene política RLS
// para la anon key (ver init-db.js).

const { Client } = require("pg");
const { verifyAdminToken } = require("./_utils");

module.exports = async function handler(req, res) {
  const isAdmin = await verifyAdminToken(req.headers.authorization);
  if (!isAdmin) {
    res.status(401).json({ ok: false, error: "not_authorized" });
    return;
  }

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    res.status(500).json({ ok: false, error: "Falta SUPABASE_DB_URL en las variables de entorno de Vercel." });
    return;
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();

    const { rows } = await client.query(`
      select
        (select count(*)::int from public.users) as total_operators,
        (select count(*)::int from public.app_contacts) as total_contacts,
        (select count(*)::int from public.app_friendships) as total_relationships,
        (select count(*)::int
           from public.app_friendships f1
           where exists (
             select 1 from public.app_friendships f2
             where f2.phone_a = f1.phone_b and f2.phone_b = f1.phone_a
           )
        ) / 2 as total_mutual_friendships
    `);

    res.status(200).json({ ok: true, metrics: rows[0] });
  } catch (err) {
    console.error("admin-metrics falló:", err);
    // 42P01 = "undefined_table" en Postgres — alguna tabla todavía no
    // existe (falta correr /api/init-db) — mismo criterio de diagnóstico
    // que admin-list-users.js.
    if (err.code === "42P01") {
      res.status(200).json({ ok: false, error: "table_missing" });
      return;
    }
    res.status(500).json({ ok: false, error: "server_error" });
  } finally {
    await client.end().catch(() => {});
  }
};
