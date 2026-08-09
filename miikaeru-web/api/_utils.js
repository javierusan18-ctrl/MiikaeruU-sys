// Utilidades compartidas por las Serverless Functions de cuentas
// (register-account, login-account, admin-list-users,
// admin-reset-password) — NO es una ruta en sí misma: el prefijo "_" en
// el nombre de archivo hace que Vercel la excluya del ruteo automático
// de /api (así como init-db.js SÍ es una ruta real, este archivo nunca
// queda expuesto como endpoint público).

const crypto = require("crypto");

const SCRYPT_KEYLEN = 64;

// Hashea una contraseña con scrypt (nativo del módulo `crypto` de
// Node — sin dependencias nuevas) + salt aleatorio de 16 bytes. Se
// guarda como "saltHex:hashHex" en la misma columna `password` — la
// contraseña real nunca se persiste en ningún lado, solo viaja una vez
// por HTTPS en el body del request inicial.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt}:${derived.toString("hex")}`;
}

// Comparación a tiempo constante (timingSafeEqual) contra el hash
// derivado de la contraseña recibida — evita filtrar por timing cuánto
// del hash coincide, mismo criterio que cualquier verificación de
// contraseña seria.
function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored.includes(":")) return false;
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const storedBuf = Buffer.from(hashHex, "hex");
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  if (storedBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(storedBuf, derived);
}

// Debe coincidir EXACTAMENTE con ADMIN_EMAIL en app.js/init-db.js.
const ADMIN_EMAIL = "javierusan18@gmail.com";
// Mismos valores públicos ya embebidos en app.js (SUPABASE_URL/
// SUPABASE_KEY) — no son secretos, son la URL del proyecto y la
// "publishable key" que cualquiera puede ver abriendo el navegador.
const SUPABASE_URL = "https://pzurvgcurifdkhbfxhrv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_NApj9xOyicARat8ummK52Q_mY20RsBz";

// Verifica que el token Bearer recibido sea el de una sesión REAL de
// Supabase Auth cuyo email coincide exactamente con ADMIN_EMAIL —
// nunca confía en un email mandado directamente por el cliente (eso
// sería trivial de falsificar): le pregunta a Supabase mismo quién es
// el dueño del token, igual que cualquier verificación de sesión del
// lado del servidor.
async function verifyAdminToken(authHeader) {
  const token = typeof authHeader === "string" ? authHeader.replace(/^Bearer\s+/i, "").trim() : "";
  if (!token) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.email && data.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  } catch (err) {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword, verifyAdminToken, ADMIN_EMAIL };
