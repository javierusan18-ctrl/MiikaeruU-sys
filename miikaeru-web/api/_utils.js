// Utilidades compartidas por las Serverless Functions de cuentas
// (register-account, login-account, admin-list-users,
// admin-reset-password, admin-metrics, admin-manage-admins) — NO es una
// ruta en sí misma: el prefijo "_" en el nombre de archivo hace que
// Vercel la excluya del ruteo automático de /api (así como init-db.js SÍ
// es una ruta real, este archivo nunca queda expuesto como endpoint
// público).

const crypto = require("crypto");
const { Client } = require("pg");

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

// Comprueba si un email (ya verificado como dueño de una sesión REAL de
// Supabase Auth, ver resolveAdminSession() más abajo) tiene acceso de
// Admin: el Admin Raíz (ADMIN_EMAIL) SIEMPRE pasa, sin tocar la base —
// así nunca puede quedar afuera aunque public.admins no exista todavía o
// la conexión a Postgres esté caída. Cualquier otro email pasa solo si
// aparece en public.admins (ver api/admin-manage-admins.js, la única
// forma de agregar/quitar filas ahí). Si la tabla no existe todavía o la
// consulta falla por cualquier motivo, se degrada de forma segura a
// "solo el Admin Raíz" en vez de tirar el request entero — nunca al
// revés (un fallo de red nunca debe ABRIR acceso de más).
async function isEmailAdmin(email) {
  if (!email) return false;
  const normalized = email.toLowerCase();
  if (normalized === ADMIN_EMAIL.toLowerCase()) return true;

  const connectionString = (process.env.SUPABASE_DB_URL || "").trim();
  if (!connectionString) return false;

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const { rows } = await client.query("select 1 from public.admins where lower(email) = $1", [normalized]);
    return rows.length > 0;
  } catch (err) {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

// Resuelve quién es el dueño de un token Bearer (sesión REAL de Supabase
// Auth) y si esa persona tiene acceso de Admin — nunca confía en un email
// mandado directamente por el cliente. Devuelve {email, isAdmin} en vez
// de solo un booleano para que los endpoints que necesitan saber QUIÉN
// hizo la acción (ej. admin-manage-admins.js, para el campo `added_by`)
// no tengan que volver a golpear la API de Supabase Auth por su cuenta.
async function resolveAdminSession(authHeader) {
  const token = typeof authHeader === "string" ? authHeader.replace(/^Bearer\s+/i, "").trim() : "";
  if (!token) return { email: null, isAdmin: false };
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!res.ok) return { email: null, isAdmin: false };
    const data = await res.json();
    const email = data.email || null;
    return { email, isAdmin: await isEmailAdmin(email) };
  } catch (err) {
    return { email: null, isAdmin: false };
  }
}

// Compatibilidad hacia atrás para los endpoints que solo necesitan
// saber sí/no (admin-list-users.js, admin-reset-password.js,
// admin-metrics.js) — internamente ahora chequea también public.admins,
// no solo ADMIN_EMAIL.
async function verifyAdminToken(authHeader) {
  return (await resolveAdminSession(authHeader)).isAdmin;
}

// Diagnóstico best-effort para cuando SUPABASE_DB_URL aparece "faltante"
// en tiempo de ejecución pese a que el código la lee con el nombre
// correcto (los 6 endpoints que dependen de ella hacen exactamente
// `process.env.SUPABASE_DB_URL`, sin variantes — confirmado por
// revisión exhaustiva del código, no es un typo de nombre en el repo).
// Cuando eso pasa, la causa casi siempre vive en la config de Vercel
// (variable no guardada, guardada solo para un Environment que no es
// el que sirve esta request, o guardada DESPUÉS del último deploy —
// Vercel no la inyecta en deploys ya existentes, hace falta un redeploy
// nuevo). Nunca devuelve el valor de ninguna variable, solo metadata
// que ya es pública o inofensiva: en qué Environment/branch corre esta
// función ahora mismo, y los NOMBRES (no valores) de cualquier variable
// de entorno que contenga "SUPABASE" — así, si alguien la guardó con un
// nombre ligeramente distinto (ej. "SUPABASE_DB_URI" en vez de
// "SUPABASE_DB_URL"), aparece acá mismo en la respuesta de error.
// Regex que identifica el formato "Direct connection" de Supabase
// (host db.<project-ref>.supabase.co) — ese host requiere salida IPv6,
// que las Serverless Functions de Vercel (AWS Lambda por debajo) NO
// tienen. El formato correcto para usar acá es el "Transaction pooler"
// (host aws-0-<region>.pooler.supabase.com, puerto 6543), que sí
// resuelve por IPv4. Ver Supabase → Settings → Database → Connection
// string → modo "Transaction pooler".
const DIRECT_CONNECTION_HOST_RE = /^db\..+\.supabase\.co$/i;

function getSupabaseEnvDiagnostics() {
  const rawConnectionString = (process.env.SUPABASE_DB_URL || "").trim();
  let dbHost = null;
  let dbPort = null;
  let looksLikeDirectConnectionNotPooler = null;

  if (rawConnectionString) {
    try {
      const parsed = new URL(rawConnectionString);
      dbHost = parsed.hostname || null;
      dbPort = parsed.port || null;
      looksLikeDirectConnectionNotPooler = dbHost ? DIRECT_CONNECTION_HOST_RE.test(dbHost) : null;
    } catch (err) {
      // connectionString mal formada — no revienta el diagnóstico, solo
      // deja los campos en null (la falla real ya se reporta aparte).
    }
  }

  return {
    vercelEnv: process.env.VERCEL_ENV || null,
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF || null,
    envKeysContainingSupabase: Object.keys(process.env).filter((k) => k.toUpperCase().includes("SUPABASE")),
    dbHost,
    dbPort,
    looksLikeDirectConnectionNotPooler,
  };
}

// Clasificación compartida de errores de Postgres/red para los 6
// endpoints que dependen de SUPABASE_DB_URL (login-account,
// register-account, admin-list-users, admin-reset-password,
// admin-metrics, init-db) — antes vivía duplicada solo en
// admin-metrics.js; centralizada acá para que todos devuelvan el mismo
// código corto ante la misma falla real (ej.: ENOTFOUND siempre es
// "connection_failed" en cualquiera de los 6, no solo en el que se
// haya acordado de clasificarlo).
function classifyDbError(err) {
  if (err.code === "42P01") return "table_missing"; // undefined_table
  if (err.code === "28P01" || err.code === "28000") return "auth_failed"; // credenciales inválidas
  if (err.code === "3D000") return "db_not_found"; // invalid_catalog_name
  if (["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH"].includes(err.code)) {
    // Fallo de red/DNS llegando al host — típicamente SUPABASE_DB_URL
    // apunta a la conexión directa (db.<ref>.supabase.co, requiere
    // IPv6) en vez del Transaction pooler que Vercel necesita (IPv4).
    return "connection_failed";
  }
  return "server_error";
}

// Normaliza el número de celular ANTES de guardarlo/consultarlo — MISMA
// lógica que normalizePhone() en app.js (frontend), acá aplicada de
// nuevo del lado del servidor como defensa en profundidad (cualquier
// caller directo al API, no solo el frontend actual, queda cubierto).
// Sin esto, un Operador podía "no existir" al loguearse si esta vez
// tecleaba su número con un formato apenas distinto al que usó al
// registrarse (ej.: con el "0" de marcado nacional adelante, o con
// "+"/"00" de marcado internacional). Deliberadamente CONSERVADOR: solo
// saca prefijos que son inequívocamente "solo formato" — nunca recorta
// a un largo fijo de dígitos, porque eso sí podría fusionar por error
// los números de DOS Operadores distintos.
function normalizePhone(raw) {
  if (typeof raw !== "string") return "";
  let digits = raw.trim().replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length > 8 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

module.exports = {
  hashPassword,
  verifyPassword,
  verifyAdminToken,
  resolveAdminSession,
  ADMIN_EMAIL,
  getSupabaseEnvDiagnostics,
  classifyDbError,
  normalizePhone,
};
