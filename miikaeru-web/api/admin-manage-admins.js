// Vercel Serverless Function — pestaña "🔑 Administradores" del Panel de
// Administrador: lista quién tiene acceso de Admin y le permite al
// Admin Raíz (ADMIN_EMAIL, ver api/_utils.js) otorgar o quitar ese
// acceso a otros emails. Gateado por resolveAdminSession() — solo
// alguien que YA es Admin (Raíz o ya agregado antes) puede llamar a
// este endpoint, así que un Operador nuevo (cuenta por teléfono,
// public.users) nunca puede tocar esta tabla ni de casualidad: ese
// sistema de cuentas ni siquiera pasa por acá.
//
// Requiere que el email nuevo YA tenga una cuenta real de Supabase Auth
// (email + contraseña, creada a mano desde el Dashboard de Supabase →
// Authentication → Users) — agregar un email a public.admins solo le da
// PERMISO, no le crea la cuenta: sin una sesión real de Supabase Auth
// con ese email, resolveAdminSession() nunca lo va a reconocer (ver
// isEmailAdmin() en api/_utils.js), y las políticas RLS que protegen
// `feedback` tampoco.

const { Client } = require("pg");
const { resolveAdminSession, ADMIN_EMAIL, getSupabaseEnvDiagnostics, classifyDbError } = require("./_utils");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  const session = await resolveAdminSession(req.headers.authorization);
  if (!session.isAdmin) {
    res.status(401).json({ ok: false, error: "not_authorized" });
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

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();

    if (req.method === "GET") {
      const { rows } = await client.query(
        "select email, added_by, created_at from public.admins order by created_at asc"
      );
      // El Admin Raíz siempre aparece primero y marcado — incluso si por
      // lo que sea todavía no corrió /api/init-db (que lo siembra), así
      // la pestaña nunca se ve vacía ni deja de mostrar quién manda acá.
      const rootRow = rows.find((r) => r.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
      const admins = [
        {
          email: ADMIN_EMAIL,
          added_by: "system",
          created_at: rootRow ? rootRow.created_at : null,
          isRoot: true,
        },
        ...rows
          .filter((r) => r.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase())
          .map((r) => ({ ...r, isRoot: false })),
      ];
      res.status(200).json({ ok: true, admins });
      return;
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const action = body.action;
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

      if (!EMAIL_RE.test(email)) {
        res.status(400).json({ ok: false, error: "invalid_input" });
        return;
      }

      if (action === "add") {
        await client.query(
          "insert into public.admins (email, added_by) values ($1, $2) on conflict (email) do nothing",
          [email, session.email || "unknown"]
        );
        res.status(200).json({ ok: true });
        return;
      }

      if (action === "remove") {
        // El Admin Raíz nunca se puede quitar desde acá — es la única
        // identidad que la app reconoce sin depender de esta tabla (ver
        // isEmailAdmin() en api/_utils.js), así que "borrarla" no lo
        // dejaría sin acceso igual, solo generaría una fila fantasma
        // inconsistente. Si alguna vez hace falta rotarlo de verdad, es
        // un cambio de código (ADMIN_EMAIL), no una acción de este panel.
        if (email === ADMIN_EMAIL.toLowerCase()) {
          res.status(400).json({ ok: false, error: "cannot_remove_root" });
          return;
        }
        await client.query("delete from public.admins where lower(email) = $1", [email]);
        res.status(200).json({ ok: true });
        return;
      }

      res.status(400).json({ ok: false, error: "invalid_action" });
      return;
    }

    res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (err) {
    console.error("admin-manage-admins falló:", err);
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
