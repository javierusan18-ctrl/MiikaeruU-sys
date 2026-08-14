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
// Tope de la llamada a Anthropic — sin esto, si la API upstream se cuelga
// (no cae con un error, simplemente nunca responde), esta función podía
// quedar corriendo hasta el límite propio de Vercel (mucho más largo, y
// con un mensaje de error genérico/feo) en vez de fallar rápido y limpio
// para que el cliente pueda reintentar de inmediato.
const ANTHROPIC_TIMEOUT_MS = 18000;

// Persona de cada escenario, namespaced por idioma DESTINO (ja/es) — el
// ÚNICO lugar donde vive esta descripción (ver comentario de arriba).
// Debe tener una entrada por cada `id` de JP_VOICE_SCENARIOS/
// ES_VOICE_SCENARIOS en app.js; si scenarioId no aparece en el idioma
// pedido, el request se rechaza (ver handler más abajo). Los mismos 7
// ids se reusan en ambos idiomas (factoryVoice/reportMistake/etc.) —
// mismo paradigma de escenario, personaje adaptado a cada idioma.
const SCENARIO_PERSONAS = {
  ja: {
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
  },
  es: {
    factoryVoice: {
      role: "un compañero de línea de producción en una fábrica",
      setting:
        "Estás junto al usuario en el piso de la fábrica. Le vas dando instrucciones simples sobre una tarea o le explicás qué hacer si una máquina falla (avería). Sos paciente, directo y usás vocabulario técnico básico de fábrica (máquina, pieza, no funciona, apagar, peligro).",
    },
    reportMistake: {
      role: "el jefe directo del usuario en una oficina/fábrica",
      setting:
        "El usuario te va a reportar un error que cometió en el trabajo. Reaccionás de forma profesional y calmada (nunca enojado/agresivo) — pedís detalles, sugerís cómo solucionarlo, y a veces recordás un procedimiento para evitar que se repita. Tono formal pero cercano, como corresponde entre empleado y jefe.",
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
      role: "un mesero/a en un restaurante",
      setting:
        "El usuario es un cliente pidiendo comida. Recomendás platos si preguntan, confirmás el pedido, y sos amable y servicial.",
    },
    doctorVisit: {
      role: "un médico/a en una consulta",
      setting:
        "El usuario te describe síntomas. Hacés preguntas de seguimiento simples (desde cuándo, dónde duele, fiebre) y das una recomendación breve y genérica (descansar, tomar agua, ver a un especialista) — nunca un diagnóstico real ni consejo médico serio, esto es práctica de idioma, no medicina real.",
    },
    apartmentHunt: {
      role: "un agente inmobiliario",
      setting:
        "El usuario está buscando alquilar un departamento. Le preguntás presupuesto/zona/tamaño que busca, y le describís opciones simples (precio, cantidad de habitaciones, cercanía al centro). Tono profesional y servicial.",
    },
  },
};

// Calibración de dificultad por nivel — se inserta en el system prompt
// junto a la persona del escenario. Namespaced por idioma porque los
// niveles NO coinciden (JLPT N5-N3 para japonés, CEFR A1-B1 para
// español) — mismo criterio de progresión (simple/libre → intermedio →
// natural/avanzado) en ambos.
const LEVEL_GUIDANCE = {
  ja: {
    n5: "Usá SOLO vocabulario y gramática de nivel JLPT N5: oraciones cortas y simples (sujeto-objeto-verbo básico), sin kanji complejo, ritmo lento. Evitá construcciones condicionales o pasivas.",
    n4: "Usá vocabulario y gramática de nivel JLPT N4: oraciones un poco más largas, permitite usar condicionales simples (〜たら、〜ば) y formas〜てform comunes, ritmo natural pero todavía claro.",
    n3: "Usá japonés natural de nivel JLPT N3: oraciones más largas y matizadas, gramática intermedia-avanzada (〜ことになる、〜べきだ、pasivo/causativo cuando venga al caso), ritmo conversacional real.",
  },
  es: {
    a1: "Usá SOLO vocabulario y gramática de nivel A1: oraciones cortas y simples (presente de indicativo, sin subjuntivo ni tiempos compuestos), ritmo lento y claro.",
    a2: "Usá vocabulario y gramática de nivel A2: oraciones un poco más largas, permitite usar pretérito/imperfecto y futuro simple, ritmo natural pero todavía claro.",
    b1: "Usá español natural de nivel B1: oraciones más largas y matizadas, gramática intermedia-avanzada (subjuntivo básico, condicional, voz pasiva cuando venga al caso), ritmo conversacional real.",
  },
};

const FEEDBACK_LANGUAGE_NAME = { es: "español", en: "English", ja: "日本語" };
const TARGET_LANGUAGE_NAME = { ja: "japonés", es: "español" };
// Ejemplo de frase de aclaración EN el idioma destino (ver instrucción de
// "texto transcrito por voz" más abajo) — no puede ser un texto fijo
// único porque el ejemplo mismo tiene que estar en el idioma que el
// personaje habla.
const CLARIFICATION_EXAMPLE = { ja: "すみません、もう一度お願いできますか。", es: "Perdón, ¿puedes repetir eso?" };

function buildSystemPrompt(language, scenarioId, level, interfaceLanguage) {
  const persona = SCENARIO_PERSONAS[language][scenarioId];
  const levelGuidance = LEVEL_GUIDANCE[language][level];
  const feedbackLang = FEEDBACK_LANGUAGE_NAME[interfaceLanguage] || "español";
  const targetLangName = TARGET_LANGUAGE_NAME[language];
  return [
    `Sos ${persona.role}, dentro de una app de práctica de idiomas llamada Miikaeru. Estás haciendo ROLEPLAY con un estudiante de ${targetLangName} para que practique conversación real. NUNCA salgas del personaje ni menciones que sos una IA.`,
    persona.setting,
    levelGuidance,
    `Respondé SIEMPRE en ${targetLangName} natural, en 1-3 oraciones cortas — nunca un párrafo largo, esto es una conversación hablada, no un ensayo.`,
    `Si el mensaje del estudiante tiene un error de gramática, vocabulario o pronunciación notable, dale una corrección breve, CÁLIDA y alentadora (nunca fría ni tipo "está mal") en ${feedbackLang} — mostrá SIEMPRE la forma correcta como ejemplo, con el patrón "No es así exactamente, se dice/escribe mejor así: [forma correcta]". Si no hay ningún error real, o el error es mínimo/normal para su nivel, no corrijas nada (FEEDBACK: ninguna).`,
    `El texto del estudiante puede venir transcrito por voz (reconocimiento de voz del navegador), así que a veces va a llegar cortado, con palabras raras o sin sentido por un error de transcripción — en ESE caso no digas que no entendiste de forma seca ni rompas el personaje: reaccioná de forma natural y amable pidiendo que repita, como lo haría una persona real en esa situación (ej. "${CLARIFICATION_EXAMPLE[language]}"), y seguí el hilo del escenario sin cortar el flujo de la conversación.`,
    "Formato de respuesta OBLIGATORIO, exactamente estas 2 líneas, sin nada más antes ni después:",
    `REPLY: <tu respuesta en ${targetLangName}, en personaje>`,
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
  // `language` es nuevo (idioma DESTINO del roleplay) — por defecto "ja"
  // si el cliente no lo manda, así el módulo Nihongo (que todavía no
  // manda este campo) sigue funcionando exactamente igual sin tocar una
  // línea de su lado.
  const language = ["ja", "es"].includes(body.language) ? body.language : "ja";
  const VALID_LEVELS_BY_LANGUAGE = { ja: ["n5", "n4", "n3"], es: ["a1", "a2", "b1"] };
  const scenarioId = typeof body.scenarioId === "string" ? body.scenarioId : "";
  const level = VALID_LEVELS_BY_LANGUAGE[language].includes(body.level) ? body.level : null;
  const interfaceLanguage = typeof body.interfaceLanguage === "string" ? body.interfaceLanguage : "es";
  const userMessage = typeof body.userMessage === "string" ? body.userMessage.slice(0, MAX_MESSAGE_LENGTH) : "";
  const history = Array.isArray(body.history) ? body.history : [];

  if (!SCENARIO_PERSONAS[language][scenarioId]) {
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
  const systemPrompt = buildSystemPrompt(language, scenarioId, level, interfaceLanguage);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);
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
      signal: controller.signal,
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
    // Defensa extra: si por algún motivo el modelo no respetó el formato
    // REPLY:/FEEDBACK: Y el fallback de parseModelReply() también dio
    // vacío, no se manda una burbuja en blanco al cliente — se trata
    // igual que cualquier otra falla del LLM (el cliente ya sabe
    // reaccionar a eso de forma cálida, ver appendVoiceChatFailureBubble()
    // en app.js).
    if (!reply || !reply.trim()) {
      res.status(502).json({ ok: false, error: "empty_reply" });
      return;
    }
    res.status(200).json({ ok: true, reply, feedback });
  } catch (err) {
    const timedOut = err && err.name === "AbortError";
    console.error("ai-conversation falló:", timedOut ? "timeout" : err.message);
    res.status(timedOut ? 504 : 500).json({ ok: false, error: timedOut ? "timeout" : "server_error", detail: timedOut ? "Anthropic no respondió a tiempo." : err.message });
  } finally {
    clearTimeout(timeoutId);
  }
};
