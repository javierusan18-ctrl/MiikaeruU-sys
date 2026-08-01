// Envoltorio de Playwright — todo lo que la IA Jugador puede "hacer" en el
// navegador vive acá, como funciones simples que claude-player.js expone
// como herramientas. Nada de esto sabe nada de Claude ni de Supabase.

const { chromium } = require("playwright");

// `page.accessibility.snapshot()` ya no existe en Playwright moderno (fue
// removido — confirmado corriendo esto contra la v1.62 instalada, que tira
// "Cannot read properties of undefined (reading 'snapshot')"). El
// reemplazo real es `locator.ariaSnapshot()`: devuelve el árbol de
// accesibilidad como texto estilo YAML — el MISMO formato que ya devuelve
// mi propia herramienta read_page dentro de esta sesión de Claude Code
// (mcp__Claude_Browser__read_page), así que Claude ya sabe leerlo bien sin
// que yo tenga que aplanarlo a mano a una lista de {role, name}.
const MAX_TEXT_CHARS = 2000;
const MAX_SNAPSHOT_CHARS = 4000;

class BrowserSession {
  constructor() {
    this.browser = null;
    this.page = null;
    this.consoleErrors = [];
  }

  async launch(targetUrl) {
    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();

    // Errores de JS reales (no console.log/warn — solo lo que un dev
    // consideraría un bug) y excepciones no atrapadas, acumulados acá para
    // que read_console_errors() los devuelva cuando la IA Jugador los pida.
    this.page.on("console", (msg) => {
      if (msg.type() === "error") {
        this.consoleErrors.push(`[console.error] ${msg.text()}`);
      }
    });
    this.page.on("pageerror", (err) => {
      this.consoleErrors.push(`[uncaught exception] ${err.message}`);
    });

    await this.page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
  }

  async readPage() {
    const title = await this.page.title();
    const url = this.page.url();

    let ariaSnapshot = "";
    try {
      ariaSnapshot = await this.page.locator("body").ariaSnapshot();
    } catch (err) {
      ariaSnapshot = "(no se pudo leer el snapshot de accesibilidad: " + err.message + ")";
    }
    if (ariaSnapshot.length > MAX_SNAPSHOT_CHARS) {
      ariaSnapshot = ariaSnapshot.slice(0, MAX_SNAPSHOT_CHARS) + "\n… (recortado)";
    }

    let visibleText = "";
    try {
      visibleText = await this.page.locator("body").innerText({ timeout: 3000 });
    } catch (err) {
      visibleText = "(no se pudo leer el texto visible: " + err.message + ")";
    }
    if (visibleText.length > MAX_TEXT_CHARS) {
      visibleText = visibleText.slice(0, MAX_TEXT_CHARS) + "\n… (recortado)";
    }

    // `ariaSnapshot` es un árbol estilo YAML (role + name de cada elemento
    // interactivo, anidado como en la página real). Para click/type_text,
    // usá el role y el texto entre comillas de la línea correspondiente —
    // ej. `- button "Aprobar / Ejecutar"` → role: "button", name: "Aprobar / Ejecutar".
    return { title, url, visibleText, ariaSnapshot };
  }

  async click({ role, name }) {
    const locator = this.page.getByRole(role, { name, exact: false }).first();
    await locator.click({ timeout: 5000 });
    // Pequeña espera para que el estado de la UI (animaciones, fetch a
    // Supabase, etc.) se asiente antes del próximo read_page — sin esto,
    // la IA Jugador a veces "ve" la pantalla a mitad de una transición y
    // reporta un falso bug visual.
    await this.page.waitForTimeout(300);
  }

  async typeText({ role, name, text }) {
    const locator = this.page.getByRole(role, { name, exact: false }).first();
    await locator.fill(text, { timeout: 5000 });
  }

  async screenshot() {
    // Playwright espera a que las fuentes de la página terminen de cargar
    // antes de sacar la captura ("waiting for fonts to load") — en algunos
    // entornos headless esa espera nunca resuelve (confirmado: se cuelga
    // 30s enteros contra este mismo servidor local, aunque la app no usa
    // ninguna fuente web externa — fue reproducible incluso con timeout
    // corto). `caret: "initial"` no cambia esto; no hay una opción
    // documentada para saltear el paso. Se degrada con gracia: si la
    // captura falla, se devuelve null y quien llama (claude-player.js)
    // se lo comunica al modelo como "no disponible" en vez de colgar toda
    // la sesión.
    try {
      const buffer = await this.page.screenshot({ type: "jpeg", quality: 70, timeout: 8000 });
      return buffer.toString("base64");
    } catch (err) {
      return null;
    }
  }

  readConsoleErrors() {
    const errors = this.consoleErrors.slice();
    this.consoleErrors = [];
    return errors;
  }

  async close() {
    if (this.browser) await this.browser.close();
  }
}

module.exports = { BrowserSession };
