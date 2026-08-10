// Vercel Serverless Function — métricas rápidas para una futura pestaña
// "📊 Métricas" del Panel de Administrador. Mismo criterio de acceso que
// admin-list-users.js: solo responde si el caller manda un token Bearer
// de una sesión REAL de Supabase Auth cuyo email es ADMIN_EMAIL (ver
// verifyAdminToken() en api/_utils.js), y corre con la conexión directa
// a Postgres (SUPABASE_DB_URL) porque public.users no tiene política RLS
// para la anon key (ver init-db.js).

const { Client } = require("pg");
const { verifyAdminToken, getSupabaseEnvDiagnostics } = require("./_utils");

module.exports = async function handler(req, res) {
  const isAdmin = await verifyAdminToken(req.headers.authorization);
  if (!isAdmin) {
    res.status(401).json({ ok: false, error: "not_authorized" });
    return;
  }

  // .trim() defensivo: si la variable se pegó en Vercel con un salto de
  // línea o espacio colgando (copy-paste desde terminal/archivo), pg
  // puede fallar al parsear la connection string con un error críptico
  // en vez de decir claramente "está vacía" o "está mal formada".
  const connectionString = (process.env.SUPABASE_DB_URL || "").trim();
  if (!connectionString) {
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
    // Clasificación de errores de Postgres/red — el endpoint solo
    // responde a un Admin ya verificado (ver verifyAdminToken() arriba),
    // así que es seguro devolver err.message como `detail`: ayuda a
    // diagnosticar SUPABASE_DB_URL mal configurada sin tener que ir a
    // buscar los logs de Vercel.
    let error = "server_error";
    if (err.code === "42P01") {
      // undefined_table — alguna tabla todavía no existe (falta correr
      // /api/init-db desde la pestaña Base de Datos).
      error = "table_missing";
    } else if (err.code === "28P01" || err.code === "28000") {
      // invalid_password / invalid_authorization_specification — el
      // usuario/contraseña de la connection string está mal.
      error = "auth_failed";
    } else if (err.code === "3D000") {
      // invalid_catalog_name — el nombre de la base en la connection
      // string no existe en ese proyecto de Supabase.
      error = "db_not_found";
    } else if (["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH"].includes(err.code)) {
      // Fallo de red/DNS llegando al host — típicamente SUPABASE_DB_URL
      // apunta a un host/puerto incorrecto (ej.: usar la conexión directa
      // en vez del connection pooler que Vercel necesita).
      error = "connection_failed";
    }
    res.status(error === "table_missing" ? 200 : 500).json({ ok: false, error, detail: err.message });
  } finally {
    await client.end().catch(() => {});
  }
};
