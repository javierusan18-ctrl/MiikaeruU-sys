// Vercel Serverless Function — valida teléfono+contraseña contra
// public.users y devuelve los datos de la cuenta (nunca la contraseña
// ni su hash). Corre 100% server-side con la conexión directa a
// Postgres (SUPABASE_DB_URL) — ver api/register-account.js/
// api/_utils.js para el resto del criterio de esta migración.

const { Client } = require("pg");
const { verifyPassword } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const connectionString = (process.env.SUPABASE_DB_URL || "").trim();
  if (!connectionString) {
    res.status(500).json({ ok: false, error: "Falta SUPABASE_DB_URL en las variables de entorno de Vercel." });
    return;
  }

  const body = req.body || {};
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!phone || !password) {
    res.status(400).json({ ok: false, error: "invalid_credentials" });
    return;
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();

    const { rows } = await client.query(
      "select id, phone, password, name, level, xp, streak, status from public.users where phone = $1",
      [phone]
    );
    const row = rows[0];

    // Mismo mensaje genérico tanto si el teléfono no existe como si la
    // contraseña no coincide — no hay que darle a un atacante pistas de
    // cuál de los dos falló.
    if (!row || !verifyPassword(password, row.password)) {
      res.status(401).json({ ok: false, error: "invalid_credentials" });
      return;
    }
    if (row.status !== "active") {
      res.status(403).json({ ok: false, error: "account_suspended" });
      return;
    }

    delete row.password;
    res.status(200).json({ ok: true, user: row });
  } catch (err) {
    console.error("login-account falló:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  } finally {
    await client.end().catch(() => {});
  }
};
