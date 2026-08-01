// El bucle de agente en sí: Claude decide qué hacer, este archivo traduce
// esas decisiones a llamadas reales sobre BrowserSession (lib/browser.js) y
// SupabaseWriter (lib/supabase-writer.js). Usa el Tool Runner beta del SDK
// oficial de Anthropic — la SDK maneja el ciclo llamar→ejecutar→devolver
// resultado→repetir, acá solo se definen las herramientas.
//
// Referencia: skill claude-api de este proyecto, sección "Tool Runner" de
// typescript/claude-api/tool-use.md — JS usa el mismo SDK que TypeScript.

const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const { betaTool } = require("@anthropic-ai/sdk/helpers/beta/json-schema");

const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, "..", "prompts", "system.md"), "utf8");

async function runSession({ config, browserSession, supabaseWriter, maxActions, maxFindings, dryRun, onEvent }) {
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  let actionCount = 0;
  let findingCount = 0;
  let finished = false;
  let finishSummary = null;

  function log(event, detail) {
    if (onEvent) onEvent(event, detail);
  }

  function checkActionBudget() {
    actionCount += 1;
    if (actionCount > maxActions) {
      return `Se alcanzó el límite de ${maxActions} acciones de esta sesión. Llamá a finish_session ahora con un resumen de lo que exploraste.`;
    }
    return null;
  }

  const tools = [
    betaTool({
      name: "read_page",
      description:
        "Lee el estado actual de la pantalla: título, URL, texto visible, y la lista de elementos con los que podés interactuar (cada uno con su role y name). Llamala después de cada acción para ver qué cambió.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      run: async () => {
        const budgetMsg = checkActionBudget();
        if (budgetMsg) return budgetMsg;
        const page = await browserSession.readPage();
        log("read_page", page);
        return JSON.stringify(page, null, 2);
      },
    }),

    betaTool({
      name: "click",
      description:
        "Hace clic en un elemento de la pantalla, identificado por el role y name exactos que viste en read_page.",
      inputSchema: {
        type: "object",
        properties: {
          role: { type: "string", description: "El role de accesibilidad del elemento (ej. 'button', 'link', 'tab')." },
          name: { type: "string", description: "El nombre/texto visible del elemento, tal como apareció en read_page." },
        },
        required: ["role", "name"],
        additionalProperties: false,
      },
      run: async ({ role, name }) => {
        const budgetMsg = checkActionBudget();
        if (budgetMsg) return budgetMsg;
        try {
          await browserSession.click({ role, name });
          log("click", { role, name });
          return `Clic hecho en ${role} "${name}".`;
        } catch (err) {
          return `No se pudo hacer clic en ${role} "${name}": ${err.message}`;
        }
      },
    }),

    betaTool({
      name: "type_text",
      description: "Escribe texto en un campo de formulario, identificado por role y name.",
      inputSchema: {
        type: "object",
        properties: {
          role: { type: "string", description: "El role de accesibilidad del campo (normalmente 'textbox')." },
          name: { type: "string", description: "El nombre/label del campo, tal como apareció en read_page." },
          text: { type: "string", description: "El texto a escribir. Usá datos de prueba obvios, nunca información real." },
        },
        required: ["role", "name", "text"],
        additionalProperties: false,
      },
      run: async ({ role, name, text }) => {
        const budgetMsg = checkActionBudget();
        if (budgetMsg) return budgetMsg;
        try {
          await browserSession.typeText({ role, name, text });
          log("type_text", { role, name, text });
          return `Texto escrito en ${role} "${name}".`;
        } catch (err) {
          return `No se pudo escribir en ${role} "${name}": ${err.message}`;
        }
      },
    }),

    betaTool({
      name: "screenshot",
      description:
        "Saca una captura de la pantalla actual para confirmar visualmente un problema de layout antes de reportarlo (read_page solo da texto plano, no muestra estilos ni posición).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      run: async () => {
        const base64 = await browserSession.screenshot();
        // BrowserSession.screenshot() devuelve null si Playwright se cuelga
        // esperando fuentes que nunca terminan de "cargar" (ver el
        // comentario en lib/browser.js) — degradado con gracia acá en vez
        // de crashear la sesión entera por un problema del entorno, no de
        // la app.
        if (base64 === null) {
          log("screenshot", { failed: true });
          return "No se pudo tomar la captura en este entorno (timeout esperando fuentes). Seguí con read_page/read_console_errors para este hallazgo.";
        }
        log("screenshot", { bytes: base64.length });
        return [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
          { type: "text", text: "Captura de la pantalla actual." },
        ];
      },
    }),

    betaTool({
      name: "read_console_errors",
      description:
        "Devuelve los errores de JavaScript (console.error y excepciones no atrapadas) que ocurrieron desde la última vez que se llamó a esta herramienta. Muchos bugs reales no se ven en pantalla, solo acá.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      run: async () => {
        const errors = browserSession.readConsoleErrors();
        log("read_console_errors", { count: errors.length });
        if (!errors.length) return "Sin errores nuevos de consola.";
        return errors.join("\n");
      },
    }),

    betaTool({
      name: "report_finding",
      description:
        "Reporta un problema real (bug visual, de lógica, o de rendimiento) — inserta una tarea pendiente en el Panel de Administrador para que un humano la revise. Ver prompts/bug-report-schema.md para el criterio de qué SÍ y qué NO reportar.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Resumen corto en imperativo, máximo 70 caracteres." },
          description: { type: "string", description: "Qué viste, en qué pantalla, y qué esperabas que pasara en vez de eso." },
          type: { type: "string", enum: ["bugfix", "performance", "visual"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          steps_to_reproduce: { type: "string", description: "Los pasos concretos que seguiste para llegar al problema." },
          console_errors: { type: "string", description: "Si read_console_errors mostró algo relacionado, pegalo acá tal cual. Omitir si no aplica." },
        },
        required: ["title", "description", "type", "priority", "steps_to_reproduce"],
        additionalProperties: false,
      },
      run: async (finding) => {
        findingCount += 1;
        if (findingCount > maxFindings) {
          return `Se alcanzó el límite de ${maxFindings} hallazgos de esta sesión. No reportes más — seguí explorando o llamá a finish_session.`;
        }
        log("finding", finding);
        if (dryRun) {
          return `[--dry-run] Hallazgo registrado localmente, NO insertado en Supabase: "${finding.title}"`;
        }
        try {
          const row = await supabaseWriter.insertFinding(finding);
          return `Hallazgo insertado en automation_tasks con id ${row.id}, status "pending".`;
        } catch (err) {
          return `Error al insertar el hallazgo: ${err.message}`;
        }
      },
    }),

    betaTool({
      name: "finish_session",
      description: "Termina la sesión de juego. Llamala cuando ya exploraste una porción representativa de la app o no se te ocurran más acciones con sentido.",
      inputSchema: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Resumen breve de qué probaste y qué encontraste." },
        },
        required: ["summary"],
        additionalProperties: false,
      },
      run: async ({ summary }) => {
        finished = true;
        finishSummary = summary;
        log("finish_session", { summary });
        return "Sesión finalizada.";
      },
    }),
  ];

  const runner = client.beta.messages.toolRunner({
    model: config.model,
    max_tokens: config.maxTokensPerTurn,
    output_config: { effort: config.effort },
    system: SYSTEM_PROMPT,
    tools,
    messages: [
      {
        role: "user",
        content:
          "Arrancá explorando la pantalla actual con read_page. Jugá la app buscando bugs reales, siguiendo las reglas del prompt de sistema.",
      },
    ],
  });

  // Techo duro de turnos del bucle, independiente de max-actions — cada
  // turno puede incluir varias llamadas a herramientas en paralelo, así que
  // esto es un cinturón de seguridad extra contra un bucle que nunca llama
  // a finish_session por su cuenta.
  const MAX_TURNS = 200;
  let turns = 0;
  for await (const _message of runner) {
    turns += 1;
    if (finished || turns >= MAX_TURNS || actionCount > maxActions) break;
  }

  return {
    finished,
    summary: finishSummary,
    actionsUsed: Math.min(actionCount, maxActions),
    findingsReported: Math.min(findingCount, maxFindings),
  };
}

module.exports = { runSession };
