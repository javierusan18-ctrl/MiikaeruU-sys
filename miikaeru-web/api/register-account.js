// Vercel Serverless Function — crea una Cuenta de Operador nueva en
// public.users (ver el CREATE TABLE en init-db.js). Reemplaza el
// registro local-only anterior (localStorage de un solo dispositivo,
// ver MASTER_ACCOUNT_KEY en app.js): ahora el teléfono+contraseña vive
// en Supabase, así que la misma cuenta funciona desde cualquier
// dispositivo. Corre 100% server-side con la conexión directa a
// Postgres (SUPABASE_DB_URL, mismo criterio que init-db.js) — la
// contraseña se hashea acá (ver api/_utils.js) y jamás se guarda en
// texto plano.

const { Client } = require("pg");
const { hashPassword, getSupabaseEnvDiagnostics, classifyDbError } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

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

  const body = req.body || {};
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;

  if (!phone || !password || password.length < 4) {
    res.status(400).json({ ok: false, error: "invalid_input" });
    return;
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();

    const existing = await client.query("select 1 from public.users where phone = $1", [phone]);
    if (existing.rows.length > 0) {
      res.status(409).json({ ok: false, error: "account_exists" });
      return;
    }

    const hashed = hashPassword(password);
    const { rows } = await client.query(
      `insert into public.users (phone, password, name)
       values ($1, $2, $3)
       returning id, phone, name, level, xp, streak, status, created_at`,
      [phone, hashed, name]
    );

    res.status(200).json({ ok: true, user: rows[0] });
  } catch (err) {
    console.error("register-account falló:", err);
    const error = classifyDbError(err);
    res.status(error === "table_missing" ? 200 : 500).json({
      ok: false,
      error,
      detail: err.message,
      diagnostics: getSupabaseEnvDiagnostics(),
    });
  } finally {
    await client.end().catch(() => {});
  }
};
