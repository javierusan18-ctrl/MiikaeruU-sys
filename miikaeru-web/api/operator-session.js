// Vercel Serverless Function — renueva el JWT de Operador (ver
// signOperatorToken() en api/_utils.js) antes de que venza, sin volver a
// pedir la contraseña. Solo acepta un token de Operador TODAVÍA válido
// (firma + vencimiento): uno vencido o ajeno no se renueva, hace falta
// un login real. Revisa además que la cuenta siga existiendo y activa en
// public.users — así una cuenta suspendida desde el Panel de
// Administrador pierde el acceso a Amigos/Escuadrones como mucho al
// vencer su token actual, en vez de renovarlo para siempre.

const { Client } = require("pg");
const { verifyOperatorToken, signOperatorToken, classifyDbError } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const payload = verifyOperatorToken(req.headers.authorization);
  if (!payload) {
    res.status(401).json({ ok: false, error: "invalid_session" });
    return;
  }

  const connectionString = (process.env.SUPABASE_DB_URL || "").trim();
  if (!connectionString) {
    res.status(500).json({ ok: false, error: "missing_env" });
    return;
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const { rows } = await client.query("select id, phone, status from public.users where phone = $1", [
      payload.op_phone,
    ]);
    const row = rows[0];
    if (!row || String(row.id) !== String(payload.sub) || row.status !== "active") {
      res.status(401).json({ ok: false, error: "invalid_session" });
      return;
    }
    res.status(200).json({ ok: true, session: signOperatorToken(row) });
  } catch (err) {
    console.error("operator-session falló:", err);
    res.status(500).json({ ok: false, error: classifyDbError(err) });
  } finally {
    await client.end().catch(() => {});
  }
};
