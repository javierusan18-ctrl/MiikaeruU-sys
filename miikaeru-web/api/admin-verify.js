// Vercel Serverless Function — única fuente de verdad server-side sobre
// "¿esta sesión es de Admin?", para que el frontend (ver
// checkAdminSession()/adminLoginForm en app.js) deje de decidirlo a mano
// comparando el email contra ADMIN_EMAIL localmente. Esa comparación local
// ignoraba por completo la tabla public.admins (ver
// api/admin-manage-admins.js): un Admin agregado ahí podía autenticarse
// contra Supabase Auth pero el Panel de Administrador nunca se le
// mostraba, porque el frontend solo reconocía al Admin Raíz. Este
// endpoint reusa exactamente el mismo criterio que ya protege
// admin-metrics/admin-list-users/admin-reset-password/admin-manage-admins
// (resolveAdminSession(), ver api/_utils.js) — Admin Raíz siempre pasa,
// cualquier otro email pasa solo si está en public.admins, y cualquier
// fallo de red/tabla degrada a "no admin" en vez de abrir acceso de más.
//
// No requiere SUPABASE_DB_URL para responder que alguien SÍ es Admin
// Raíz (isEmailAdmin() ya corta ahí antes de tocar la base) — solo la
// necesita para el caso de un Admin agregado por tabla, igual que el
// resto de los endpoints admin-*.

const { resolveAdminSession } = require("./_utils");

module.exports = async function handler(req, res) {
  const session = await resolveAdminSession(req.headers.authorization);
  res.status(200).json({ ok: true, isAdmin: session.isAdmin, email: session.email });
};
