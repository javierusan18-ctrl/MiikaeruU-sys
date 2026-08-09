// Vercel Serverless Function — el Admin fija una contraseña nueva para
// cualquier teléfono registrado en public.users. Mismo gate que
// admin-list-users.js (token Bearer de Supabase Auth verificado contra
// ADMIN_EMAIL server-side) + conexión directa a Postgres. La contraseña
// nueva se hashea acá mismo (ver hashPassword() en api/_utils.js) antes
// de tocar la base — nunca queda en texto plano ni en la tabla ni en
// ningún log.

const { Client } = require("pg");
const { verifyAdminToken, hashPassword } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const isAdmin = await verifyAdminToken(req.headers.authorization);
  if (!isAdmin) {
    res.status(401).json({ ok: false, error: "not_authorized" });
    return;
  }

  const connectionString = (process.env.SUPABASE_DB_URL || "").trim();
  if (!connectionString) {
    res.status(500).json({ ok: false, error: "Falta SUPABASE_DB_URL en las variables de entorno de Vercel." });
    return;
  }

  const body = req.body || {};
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!phone || !newPassword || newPassword.length < 4) {
    res.status(400).json({ ok: false, error: "invalid_input" });
    return;
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const hashed = hashPassword(newPassword);
    const { rowCount } = await client.query("update public.users set password = $1 where phone = $2", [
      hashed,
      phone,
    ]);
    if (rowCount === 0) {
      res.status(404).json({ ok: false, error: "user_not_found" });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("admin-reset-password falló:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  } finally {
    await client.end().catch(() => {});
  }
};
