// Vercel Serverless Function — lee la FOTO de un horario de trabajo o de
// clases y devuelve bloques fijos { title, kind, days, start, end } para la
// pestaña «Horario» del Calendario (app.js: schedReadPhoto()). El usuario
// revisa la lista antes de guardar: nada se guarda solo.
//
// Mismo patrón que ai-conversation.js: fetch nativo a Anthropic (sin SDK
// nuevo), la API key solo vive en el servidor, modelo barato por defecto
// (ANTHROPIC_MODEL lo cambia sin tocar código) y tope de tiempo.
// Costo aproximado: ~US$0,005 por foto (imagen achicada a 1600 px en el
// teléfono antes de enviarla).

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_TIMEOUT_MS = 25000;
const MAX_TOKENS = 1500;
const MAX_IMAGE_CHARS = 3500000; // ~2,6 MB en base64; el teléfono manda ~200-500 KB
const MAX_BLOCKS = 40;
const VALID_MEDIA = ["image/jpeg", "image/png", "image/webp"];
const VALID_KINDS = ["trabajo", "estudio", "otro"];

const PROMPT = `Esta imagen es el horario de una persona (trabajo, turnos, clases o estudio). Puede ser una foto de papel, una pizarra, una captura de pantalla o un calendario de turnos.

Extrae SOLO los bloques de tiempo fijos que se repiten cada semana. Responde ÚNICAMENTE con JSON válido, sin texto antes ni después, con esta forma:
{"bloques":[{"titulo":"Trabajo","tipo":"trabajo","dias":[1,2,3,4,5],"inicio":"09:00","fin":"18:00"}],"nota":""}

Reglas:
- "tipo": "trabajo", "estudio" (clases, cursos, universidad, academia) u "otro".
- "dias": números del día de la semana, 0 = domingo, 1 = lunes ... 6 = sábado.
- "inicio" y "fin" en formato 24 horas HH:MM. Si el turno termina al día siguiente (turno de noche), "fin" es menor que "inicio".
- Si varias filas tienen el mismo título y la misma hora en días distintos, júntalas en un solo bloque con varios días.
- Si el horario está por fechas (calendario de turnos), usa el día de la semana de cada fecha y junta los que se repiten.
- Títulos cortos en español (máximo 40 letras); si el horario está en otro idioma, tradúcelo.
- Si no se lee una hora, no inventes: omite ese bloque y explícalo en "nota" (máximo 140 letras).
- Si la imagen no es un horario, responde {"bloques":[],"nota":"La imagen no parece un horario."}`;

function cleanTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59) return null;
  return `${String(h % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Nunca confiar en lo que devuelve el modelo: se valida campo por campo.
function sanitizeBlocks(parsed) {
  const raw = parsed && Array.isArray(parsed.bloques) ? parsed.bloques : [];
  const blocks = [];
  raw.slice(0, MAX_BLOCKS).forEach((item) => {
    if (!item || typeof item !== "object") return;
    const start = cleanTime(item.inicio);
    const end = cleanTime(item.fin);
    const days = Array.isArray(item.dias)
      ? [...new Set(item.dias.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
      : [];
    const title = String(item.titulo || "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (!start || !end || start === end || !days.length) return;
    blocks.push({
      title: title || "Horario fijo",
      kind: VALID_KINDS.includes(item.tipo) ? item.tipo : "otro",
      days,
      start,
      end,
    });
  });
  const note = parsed && typeof parsed.nota === "string" ? parsed.nota.trim().slice(0, 140) : "";
  return { blocks, note };
}

function extractJson(text) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last <= first) return null;
  try {
    return JSON.parse(text.slice(first, last + 1));
  } catch (err) {
    return null;
  }
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
  const image = typeof body.image === "string" ? body.image.trim() : "";
  const mediaType = VALID_MEDIA.includes(body.mediaType) ? body.mediaType : null;
  if (!image || !mediaType || !/^[A-Za-z0-9+/=]+$/.test(image)) {
    res.status(400).json({ ok: false, error: "invalid_image" });
    return;
  }
  if (image.length > MAX_IMAGE_CHARS) {
    res.status(413).json({ ok: false, error: "image_too_large" });
    return;
  }

  const model = (process.env.ANTHROPIC_MODEL || "").trim() || DEFAULT_MODEL;
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
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: PROMPT },
          ],
        }],
      }),
      signal: controller.signal,
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => "");
      console.error("leer-horario: Anthropic respondió con error", anthropicRes.status, errText.slice(0, 300));
      res.status(502).json({ ok: false, error: "llm_error", detail: `Anthropic status ${anthropicRes.status}` });
      return;
    }

    const data = await anthropicRes.json();
    const rawText = Array.isArray(data.content) ? data.content.map((block) => block.text || "").join("") : "";
    const parsed = extractJson(rawText);
    if (!parsed) {
      res.status(502).json({ ok: false, error: "unreadable_reply" });
      return;
    }
    const { blocks, note } = sanitizeBlocks(parsed);
    res.status(200).json({ ok: true, blocks, note });
  } catch (err) {
    const timedOut = err && err.name === "AbortError";
    console.error("leer-horario falló:", timedOut ? "timeout" : err.message);
    res.status(timedOut ? 504 : 500).json({ ok: false, error: timedOut ? "timeout" : "server_error" });
  } finally {
    clearTimeout(timeoutId);
  }
};

module.exports.sanitizeBlocks = sanitizeBlocks;
module.exports.extractJson = extractJson;
