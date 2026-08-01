// Inserta hallazgos en `automation_tasks` — la misma tabla que ya lee la
// pestaña "🤖 Automatización (n8n)" del Panel de Administrador (ver
// AUTOMATION_WORKFLOW.md, Bloque 58-61). Usa la clave pública ("publishable")
// que ya está embebida en miikaeru-web/app.js — no es un secreto nuevo, ver
// tools/ai-player/README.md.

const { createClient } = require("@supabase/supabase-js");

function createWriter(config) {
  const client = createClient(config.supabaseUrl, config.supabaseKey);

  // Ver prompts/bug-report-schema.md para el significado de cada campo y
  // un ejemplo completo. `finding` es lo que la IA Jugador manda en la
  // llamada a la herramienta report_finding — este helper solo lo traduce
  // a la forma real de la fila (title/status/payload) documentada en el
  // Bloque 60/61.
  async function insertFinding(finding) {
    const description = finding.steps_to_reproduce
      ? `${finding.description}\n\nPasos para reproducir:\n${finding.steps_to_reproduce}`
      : finding.description;

    const row = {
      title: finding.title,
      status: "pending",
      payload: {
        description,
        type: finding.type,
        priority: finding.priority,
        source: "ai-player",
        affected_files: null,
        notes: finding.console_errors || null,
      },
    };

    const { data, error } = await client.from("automation_tasks").insert(row).select().single();
    if (error) {
      throw new Error(`No se pudo insertar el hallazgo en Supabase: ${error.message}`);
    }
    return data;
  }

  return { insertFinding };
}

module.exports = { createWriter };
