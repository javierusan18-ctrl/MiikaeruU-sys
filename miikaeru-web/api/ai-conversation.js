// Vercel Serverless Function — "cerebro" del módulo de Conversación por
// Voz con IA (roleplay N5/N4/N3, ver app.js: openVoiceChatModal() y
// alrededores). A diferencia de MiikaeruHub/defaultAIAdapter (app.js,
// 100% local/scripteado, sin red) esto SÍ necesita comprensión y
// generación de lenguaje natural real — corre server-side porque la API
// key de Anthropic nunca puede vivir en el navegador. Mismo patrón que
// el resto de api/*.js (login-account.js, etc.): sin SDK nuevo, `fetch`
// nativo (Node 18+, ya usado así en _utils.js/resolveAdminSession()).
//
// Seguridad del prompt: el cliente SOLO manda `scenarioId` (validado
// contra SCENARIO_PERSONAS de abajo) — la descripción del personaje
// vive únicamente acá, nunca viaja desde el navegador. Evita que
// alguien reemplace el system prompt mandando texto arbitrario en vez
// de un id — mismo criterio "nunca confiar en lo que manda el cliente"
// que ya aplica resolveAdminSession() en _utils.js.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
// Modelo barato/rápido por defecto — de sobra para turnos cortos de
// roleplay; configurable sin tocar código si algún día hace falta más
// calidad (ANTHROPIC_MODEL en Vercel → Environment Variables).
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
// Guardrails de costo (pedido explícito de "bajo costo"): sin
// infraestructura de rate-limit por usuario todavía (los Operadores no
// tienen un token Bearer verificable server-side hoy, a diferencia de
// Admin vía Supabase Auth) — esto acota el costo de UNA sesión, no
// previene abuso coordinado entre sesiones distintas.
const MAX_HISTORY_TURNS = 24;
const MAX_TOKENS = 300;
const MAX_MESSAGE_LENGTH = 500;

// Persona de cada escenario — el ÚNICO lugar donde vive esta
// descripción (ver comentario de arriba). Debe tener una entrada por
// cada `id` de JP_VOICE_SCENARIOS en app.js; si un scenarioId no
// aparece acá, el request se rechaza (ver handler más abajo).
const SCENARIO_PERSONAS = {
  factoryVoice: {
    role: "un compañero de línea de producción en una fábrica japonesa",
    setting:
      "Estás junto al usuario en el piso de la fábrica. Le vas dando instrucciones simples sobre una tarea o le explicás qué hacer si una máquina falla (avería). Sos paciente, directo y usás vocabulario técnico básico de fábrica (機械、部品、動かない、止める、危険).",
  },
  reportMistake: {
    role: "el jefe directo del usuario en una oficina/fábrica japonesa",
    setting:
      "El usuario te va a reportar un error que cometió en el trabajo. Reaccionás de forma profesional y calmada (nunca enojado/agresivo) — pedís detalles, sugerís cómo solucionarlo, y a veces recordás un procedimiento para evitar que se repita. Tono formal (敬語 básico), como corresponde entre empleado y jefe.",
  },
  teamMeeting: {
    role: "un colega en una reunión breve de coordinación de tareas",
    setting:
      "Están coordinando quién hace qué tarea hoy/esta semana. Proponés tareas, preguntás disponibilidad, y confirmás acuerdos. Tono profesional pero relajado, entre compañeros del mismo nivel.",
  },
  systemTraining: {
    role: "un instructor que capacita al usuario en un sistema/software nuevo de la empresa",
    setting:
      "Le vas explicando paso a paso cómo usar un sistema nuevo (ingresar datos, generar un reporte, etc.), y le preguntás si entendió antes de seguir. Tono didáctico y paciente, como un instructor real.",
  },
  restaurant: {
    role: "un mesero/a en un restaurante japonés",
    setting:
      "El usuario es un cliente pidiendo comida. Recomendás platos si preguntan, confirmás el pedido, y sos amable y servicial — tono típico de atención al cliente japonesa (いらっしゃいませ, かしこまりました).",
  },
  doctorVisit: {
    role: "un médico/a en una consulta",
    setting:
      "El usuario te describe síntomas. Hacés preguntas de seguimiento simples (desde cuándo, dónde duele, fiebre) y das una recomendación breve y genérica (descansar, tomar agua, ver a un especialista) — nunca un diagnóstico real ni consejo médico serio, esto es práctica de idioma, no medicina real.",
  },
  apartmentHunt: {
    role: "un agente inmobiliario",
    setting:
      "El usuario está buscando alquilar un departamento. Le preguntás presupuesto/zona/tamaño que busca, y le describís opciones simples (precio, cantidad de habitaciones, cercanía a la estación). Tono profesional y servicial.",
  },
};

// Calibración de dificultad por nivel — se inserta en el system prompt
// junto a la persona del escenario. Mismo criterio de progresión ya
// usado en el resto de Nihongo (N5 simple/libre, N4 intermedio, N3
// natural/avanzado).
const LEVEL_GUIDANCE = {
  n5: "Usá SOLO vocabulario y gramática de nivel JLPT N5: oraciones cortas y simples (sujeto-objeto-verbo básico), sin kanji complejo, ritmo lento. Evitá construcciones condicionales o pasivas.",
  n4: "Usá vocabulario y gramática de nivel JLPT N4: oraciones un poco más largas, permitite usar condicionales simples (〜たら、〜ば) y formas〜てform comunes, ritmo natural pero todavía claro.",
  n3: "Usá japonés natural de nivel JLPT N3: oraciones más largas y matizadas, gramática intermedia-avanzada (〜ことになる、〜べきだ、pasivo/causativo cuando venga al caso), ritmo conversacional real.",
};

const FEEDBACK_LANGUAGE_NAME = { es: "español", en: "English", ja: "日本語" };

function buildSystemPrompt(scenarioId, level, interfaceLanguage) {
  const persona = SCENARIO_PERSONAS[scenarioId];
  const levelGuidance = LEVEL_GUIDANCE[level];
  const feedbackLang = FEEDBACK_LANGUAGE_NAME[interfaceLanguage] || "español";
  return [
    `Sos ${persona.role}, dentro de una app de práctica de japonés llamada Miikaeru. Estás haciendo ROLEPLAY con un estudiante para que practique conversación real. NUNCA salgas del personaje ni menciones que sos una IA.`,
    persona.setting,
    levelGuidance,
    "Respondé SIEMPRE en japonés natural (con algo de kanji apropiado al nivel), en 1-3 oraciones cortas — nunca un párrafo largo, esto es una conversación hablada, no un ensayo.",
    `Si el mensaje del estudiante tiene un error de gramática o vocabulario notable, dale una corrección MUY breve (una frase) en ${feedbackLang}. Si no hay ningún error real, o el error es mínimo/normal para su nivel, no corrijas nada.`,
    "Formato de respuesta OBLIGATORIO, exactamente estas 2 líneas, sin nada más antes ni después:",
    "REPLY: <tu respuesta en japonés, en personaje>",
    `FEEDBACK: <corrección breve en ${feedbackLang}, o la palabra "ninguna" si no hay nada que corregir>`,
  ].join("\n\n");
}

// Parsea el formato REPLY:/FEEDBACK: — más confiable pedirle esto a un
// modelo conversacional que JSON crudo (que a veces se envuelve en
// prosa alrededor). Si el modelo no respeta el formato (raro pero
// posible), se degrada de forma segura: todo el texto como reply, sin
// feedback, en vez de romper la respuesta.
function parseModelReply(text) {
  const replyMatch = text.match(/REPLY:\s*([\s\S]*?)(?:\n+FEEDBACK:|$)/i);
  const feedbackMatch = text.match(/FEEDBACK:\s*([\s\S]*)$/i);
  const reply = replyMatch ? replyMatch[1].trim() : text.trim();
  let feedback = feedbackMatch ? feedbackMatch[1].trim() : "";
  if (/^ninguna$|^none$|^なし$/i.test(feedback)) feedback = "";
  return { reply, feedback: feedback || null };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) {
    res.status(500).json({ ok: false, error: "missing_env", detail: "Falta ANTHROPIC_API_KEY en las variables de entorno de Vercel." });
    return;
  }

  const body = req.body || {};
  const scenarioId = typeof body.scenarioId === "string" ? body.scenarioId : "";
  const level = ["n5", "n4", "n3"].includes(body.level) ? body.level : null;
  const interfaceLanguage = typeof body.interfaceLanguage === "string" ? body.interfaceLanguage : "es";
  const userMessage = typeof body.userMessage === "string" ? body.userMessage.slice(0, MAX_MESSAGE_LENGTH) : "";
  const history = Array.isArray(body.history) ? body.history : [];

  if (!SCENARIO_PERSONAS[scenarioId]) {
    res.status(400).json({ ok: false, error: "invalid_scenario" });
    return;
  }
  if (!level) {
    res.status(400).json({ ok: false, error: "invalid_level" });
    return;
  }
  if (!userMessage.trim()) {
    res.status(400).json({ ok: false, error: "empty_message" });
    return;
  }
  if (history.length > MAX_HISTORY_TURNS) {
    res.status(400).json({ ok: false, error: "history_too_long" });
    return;
  }

  // Solo se toman `role`/`text` de cada turno del historial — cualquier
  // otro campo que el cliente mande de más se ignora (defensa en
  // profundidad, mismo criterio que el resto de estos endpoints).
  const messages = history
    .filter((turn) => turn && (turn.role === "user" || turn.role === "assistant") && typeof turn.text === "string")
    .map((turn) => ({ role: turn.role, content: turn.text.slice(0, MAX_MESSAGE_LENGTH) }))
    .concat([{ role: "user", content: userMessage }]);

  const model = (process.env.ANTHROPIC_MODEL || "").trim() || DEFAULT_MODEL;
  const systemPrompt = buildSystemPrompt(scenarioId, level, interfaceLanguage);

  try {
    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => "");
      console.error("ai-conversation: Anthropic respondió con error", anthropicRes.status, errText);
      res.status(502).json({ ok: false, error: "llm_error", detail: `Anthropic status ${anthropicRes.status}` });
      return;
    }

    const data = await anthropicRes.json();
    const rawText = Array.isArray(data.content) ? data.content.map((block) => block.text || "").join("") : "";
    if (!rawText.trim()) {
      res.status(502).json({ ok: false, error: "empty_llm_response" });
      return;
    }

    const { reply, feedback } = parseModelReply(rawText);
    res.status(200).json({ ok: true, reply, feedback });
  } catch (err) {
    console.error("ai-conversation falló:", err);
    res.status(500).json({ ok: false, error: "server_error", detail: err.message });
  }
};
