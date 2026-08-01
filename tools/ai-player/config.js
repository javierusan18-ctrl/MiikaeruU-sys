// Config + candado de seguridad de la IA Jugador. Se carga una sola vez, al
// arrancar player.js — si algo acá tira, el proceso nunca llega a abrir un
// navegador ni a llamar a Claude.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const TARGET_URL = process.env.TARGET_URL || "http://localhost:5500";

// Candado real, no una convención de nombres: si la URL objetivo no es
// localhost/127.0.0.1, el proceso se niega a arrancar. La IA Jugador
// escribe en la MISMA Supabase que usa la app en producción (ver README —
// es intencional, así los hallazgos llegan al Panel de Administrador real),
// pero nunca debe "jugar" contra el sitio publicado: un bucle de acciones
// automáticas contra producción podría registrar transacciones/feedback/
// wishlist falsos en datos de usuarios reales.
function assertLocalTarget(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    throw new Error(`TARGET_URL inválida: "${url}" (${err.message})`);
  }
  const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (!isLocal) {
    throw new Error(
      `TARGET_URL apunta a "${parsed.hostname}", no a localhost/127.0.0.1. ` +
        `La IA Jugador SOLO puede jugar contra un servidor de desarrollo local — ` +
        `nunca contra producción. Revisá TARGET_URL en .env.`
    );
  }
}

assertLocalTarget(TARGET_URL);

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error(
    "Falta ANTHROPIC_API_KEY en .env — ver tools/ai-player/README.md § Prerrequisitos. " +
      "Esta herramienta corre fuera de la sesión de Claude Code y necesita su propia clave " +
      "de console.anthropic.com."
  );
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  throw new Error("Faltan SUPABASE_URL/SUPABASE_KEY en .env — copiar de .env.example, no hace falta cambiarlos.");
}

module.exports = {
  targetUrl: TARGET_URL,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,

  // claude-opus-5 con effort "medium": punto de partida razonable para
  // exploración/QA — ver shared/models.md del skill claude-api. No usar
  // "low" (se pierde profundidad de razonamiento al decidir qué probar) ni
  // "xhigh"/"max" por default (multiplica el costo por sesión sin que la
  // tarea lo necesite tanto como una refactor grande o un debug difícil).
  model: "claude-opus-5",
  effort: "medium",
  maxTokensPerTurn: 4096,

  // Techos duros — evitan que un bucle raro del modelo corra indefinidamente
  // y gaste de más. Ver player.js --max-actions/--max-findings para
  // overridearlos desde la línea de comandos.
  defaultMaxActions: 30,
  defaultMaxFindings: 10,

  // ⚠️ La tabla `automation_tasks` tiene hoy (Bloque 60) una política RLS
  // totalmente abierta — cualquiera con SUPABASE_KEY puede escribir ahí,
  // incluida esta herramienta. Si esa política se cierra a ADMIN_EMAIL
  // únicamente (ver AUTOMATION_WORKFLOW.md), este INSERT empezará a fallar
  // con un error de RLS — en ese momento hay que decidir cómo autentica la
  // IA Jugador (usuario de servicio propio, o una política de INSERT
  // separada para source = "ai-player").
};
