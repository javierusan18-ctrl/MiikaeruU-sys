// Sistema de Ventanas Flotantes — módulo aparte (mismo criterio que
// storyEngine.js/readerEngine.js: reutilizable, sin dependencias del
// resto de app.js, cargado por <script> propio en index.html).
//
// Convierte cualquier contenedor existente en una ventana HUD
// arrastrable/redimensionable/minimizable/maximizable, sin tocar su
// contenido interno: el módulo solo agrega una barra de título (propia
// o reutilizando una que ya exista) + un grip de resize, y maneja
// position/tamaño/z-index vía clases + estilos inline en el elemento
// raíz. El contenido de adentro (chat, avatar, lo que sea) no se toca
// ni se reestructura — así no hay riesgo de romper layouts internos ya
// afinados (ej. el feed de chat con scroll propio).
//
// Uso:
//   MiikaeruFloatingWindow.enable(document.querySelector('.panel--avatar'), {
//     id: "leon",                 // clave de persistencia en localStorage
//     title: "🦁 León · UNIT-042", // solo se usa si no se pasa `header`
//     mediaQuery: "(min-width: 768px)", // se desactiva fuera de este rango
//   });
//
// Si el contenedor YA tiene su propia cabecera visual (ej. el chat, que
// ya trae "Feed // Chat" + tabs), pasarla en `header` — el módulo la
// usa como agarre de arrastre y le agrega los botones de control al
// lado, en vez de duplicar una segunda barra de título.
(function (global) {
  "use strict";

  // Banda de z-index propia para ventanas flotantes: por encima del
  // contenido normal (0-20) y de los overlays estándar de la app
  // (.modal-overlay = 100, algunos elevados a 130/200 — ver style.css),
  // pero siempre por debajo del candado de Cuenta Principal (500, el
  // techo real de toda la app) para que ese candado SIEMPRE gane.
  const Z_BASE = 150;
  const Z_MAX = 480;
  let zCounter = Z_BASE;

  // 4 bordes + 4 esquinas — redimensionar "desde cualquier borde", no
  // solo la esquina inferior-derecha de antes.
  const RESIZE_DIRECTIONS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

  // Ventana de tiempo para distinguir el mousedown "de compatibilidad"
  // que el navegador manda solo tras un pointerdown real (mismo click
  // físico) de un mousedown genuino sin Pointer Events detrás — ver el
  // comentario largo en _wireDrag() más abajo.
  const MOUSE_FALLBACK_WINDOW_MS = 80;

  function nextZ() {
    zCounter = zCounter >= Z_MAX ? Z_BASE : zCounter + 1;
    return zCounter;
  }

  function storageKey(id) {
    return `miikaeru_floatwin_${id}`;
  }

  function loadPersisted(id) {
    if (!id) return null;
    try {
      const raw = localStorage.getItem(storageKey(id));
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function savePersisted(id, data) {
    if (!id) return;
    try {
      localStorage.setItem(storageKey(id), JSON.stringify(data));
    } catch (err) {
      // Best-effort — si localStorage está lleno/bloqueado, la ventana
      // simplemente no recuerda su posición entre recargas.
    }
  }

  // Crea un botón de control minimalista (mismo criterio visual que el
  // resto de botones-ícono HUD del proyecto: fondo transparente, glow
  // cyan al hover).
  function makeControlBtn(className, label, glyph) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `floating-window__btn ${className}`;
    btn.setAttribute("aria-label", label);
    btn.title = label;
    btn.textContent = glyph;
    return btn;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  // setPointerCapture()/releasePointerCapture() pueden tirar
  // NotFoundError ("No active pointer with the given id") en casos
  // borde (puntero ya perdido/cancelado entre el pointerdown y este
  // llamado) — sin este guard, la excepción cortaba el handler ANTES
  // de llegar a los addEventListener("pointermove"/"pointerup") de
  // abajo, dejando el drag/resize trabado a mitad de camino (la clase
  // --dragging/--resizing quedaba puesta para siempre, sin ningún
  // listener vivo que la sacara). La captura en sí es solo una mejora
  // (sigue funcionando el arrastre normal sin ella, vía los listeners
  // en window), así que perderla no es motivo para romper el resto.
  function safePointerCapture(el, pointerId, capture) {
    try {
      if (capture) el.setPointerCapture(pointerId);
      else el.releasePointerCapture(pointerId);
    } catch (err) {
      // best-effort
    }
  }

  // Puente opcional hacia el historial global de Ctrl+Z (ver app.js,
  // que expone window.MiikaeruUndo porque este módulo vive en su propio
  // archivo/closure sin acceso directo a esa pila). Si todavía no
  // existe (ej. index.html cargó este script antes que app.js termine
  // de correr su DOMContentLoaded) o app.js decide no incluirlo, la
  // ventana sigue funcionando exactamente igual — el undo es un extra,
  // nunca una dependencia dura del arrastre/resize en sí.
  function pushWindowUndo(label, undoFn) {
    if (window.MiikaeruUndo && typeof window.MiikaeruUndo.push === "function") {
      window.MiikaeruUndo.push(label, undoFn);
    }
  }

  class FloatingWindow {
    constructor(el, options) {
      this.el = el;
      this.id = options.id || null;
      this.title = options.title || "";
      this.resizable = options.resizable !== false;
      this.minimizable = options.minimizable !== false;
      this.maximizable = options.maximizable !== false;
      this.closable = !!options.closable;
      this.minWidth = options.minWidth || 260;
      this.minHeight = options.minHeight || 160;
      this.mediaQuery = options.mediaQuery ? window.matchMedia(options.mediaQuery) : null;
      this.onClose = typeof options.onClose === "function" ? options.onClose : null;
      // Tope superior real (en px de viewport) que ninguna ventana puede
      // cruzar al arrastrarse/redimensionarse/restaurarse — pensado para
      // que el llamador (app.js) le pase la altura actual del header fijo
      // de arriba, así los botones de minimizar/maximizar/cerrar de
      // CUALQUIER ventana nunca terminan tapados detrás de él. Acepta un
      // número fijo o (recomendado) una función evaluada en cada arrastre
      // — el header real usa flex-wrap y puede cambiar de alto según el
      // ancho de pantalla/zoom, así que un valor fijo se desincronizaría.
      this._minTopOption = options.minTop;
      // Piso APARTE, más generoso, usado solo el instante en que la
      // ventana se despega por primera vez (_undock() — el "nacimiento"
      // real: abrir el Chat o arrastrar el León antes de que exista una
      // posición guardada). Pedido explícito: la posición inicial debe
      // dejar aire de sobra bajo el header, aunque después el usuario sí
      // pueda arrastrarla hasta el tope general (más ajustado) si quiere.
      // Si no se pasa, cae al mismo tope general de siempre (sin cambio
      // de comportamiento para ventanas que no lo necesitan, ej. docks).
      this._spawnMinTopOption = options.spawnMinTop;

      this.mode = "docked"; // "docked" | "floating" | "maximized"
      this.minimized = false;
      this.beforeMaximize = null; // { mode, top, left, width, height }
      this.dragState = null;
      this.resizeState = null;
      this._restoring = false;

      this.el.classList.add("floating-window");
      this._buildChrome(options.header || null);
      this._wireDrag();
      if (this.resizable) this._wireResize();
      this._wireFocus();
      this._restorePersisted();

      if (this.mediaQuery) {
        this._applyMediaState();
        // addEventListener("change", ...) es el estándar moderno —
        // matchMedia().addListener() está deprecado, sin soporte
        // duplicado necesario acá porque el proyecto ya asume un
        // navegador razonablemente actual (usa Pointer Events más
        // abajo, con el mismo piso de compatibilidad).
        this.mediaQuery.addEventListener("change", () => this._applyMediaState());
      }
    }

    _applyMediaState() {
      const active = !this.mediaQuery || this.mediaQuery.matches;
      this.el.classList.toggle("floating-window--inactive", !active);
      if (!active) {
        // Fuera de rango (ej. se achicó la ventana a mobile): se
        // sueltan todos los estilos inline propios y la ventana vuelve
        // a su layout responsivo normal, como si el módulo nunca
        // hubiera tocado nada.
        this._resetInlineLayout();
        this.mode = "docked";
        this.minimized = false;
        this.el.classList.remove("floating-window--floating", "floating-window--maximized", "floating-window--minimized");
      }
    }

    _resetInlineLayout() {
      this.el.style.position = "";
      this.el.style.top = "";
      this.el.style.left = "";
      this.el.style.right = "";
      this.el.style.bottom = "";
      this.el.style.width = "";
      this.el.style.height = "";
      this.el.style.maxWidth = "";
      this.el.style.maxHeight = "";
      this.el.style.flex = "";
      this.el.style.zIndex = "";
    }

    // Agrega la cabecera (propia o reutilizada) + los botones de
    // control + (si corresponde) el grip de resize. No toca ningún
    // otro nodo existente dentro de `this.el`.
    _buildChrome(existingHeader) {
      if (existingHeader) {
        this.headerEl = existingHeader;
        this.headerEl.classList.add("floating-window__header", "floating-window__header--reused");
      } else {
        this.headerEl = document.createElement("div");
        this.headerEl.className = "floating-window__header floating-window__titlebar";
        const titleSpan = document.createElement("span");
        titleSpan.className = "floating-window__title";
        titleSpan.textContent = this.title;
        this.headerEl.appendChild(titleSpan);
        this.el.insertBefore(this.headerEl, this.el.firstChild);
      }

      const controls = document.createElement("div");
      controls.className = "floating-window__controls";

      if (this.minimizable) {
        this.minimizeBtn = makeControlBtn("floating-window__btn--minimize", "Minimizar", "─");
        this.minimizeBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          this.toggleMinimize();
        });
        controls.appendChild(this.minimizeBtn);
      }

      if (this.maximizable) {
        this.maximizeBtn = makeControlBtn("floating-window__btn--maximize", "Maximizar", "▢");
        this.maximizeBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          this.toggleMaximize();
        });
        controls.appendChild(this.maximizeBtn);
      }

      if (this.closable) {
        this.closeBtn = makeControlBtn("floating-window__btn--close", "Cerrar", "✕");
        this.closeBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          this.close();
        });
        controls.appendChild(this.closeBtn);
      }

      this.headerEl.appendChild(controls);

      if (this.resizable) {
        // 8 asas (4 bordes + 4 esquinas) en vez de una sola en la
        // esquina inferior-derecha — el pedido explícito es poder
        // redimensionar "desde las esquinas/bordes", no solo una.
        this.resizeHandles = RESIZE_DIRECTIONS.map((dir) => {
          const handle = document.createElement("div");
          handle.className = `floating-window__resize-handle floating-window__resize-handle--${dir}`;
          handle.dataset.resizeDir = dir;
          handle.setAttribute("aria-hidden", "true");
          this.el.appendChild(handle);
          return handle;
        });
      }
    }

    _wireFocus() {
      // Captura en fase de captura, no burbuja — así ni siquiera un
      // stopPropagation() de algo interno (ej. un tab del chat)
      // evita que la ventana pase al frente al clickearla. `mousedown`
      // (deduplicado igual que en _wireDrag()/_wireResize()) es el
      // mismo respaldo por si Pointer Events no dispara en el mouse
      // físico del usuario.
      let lastPointerDownAt = 0;
      this.el.addEventListener(
        "pointerdown",
        () => {
          lastPointerDownAt = Date.now();
          this.el.style.zIndex = String(nextZ());
        },
        { capture: true }
      );
      this.el.addEventListener(
        "mousedown",
        () => {
          if (Date.now() - lastPointerDownAt < MOUSE_FALLBACK_WINDOW_MS) return;
          this.el.style.zIndex = String(nextZ());
        },
        { capture: true }
      );
    }

    // Punto de verdad único para "¿este panel puede volverse flotante
    // ahora mismo?". Antes esto se decidía comparando this.mediaQuery.matches
    // (un cómputo de matchMedia() separado, hecho en JS) — pero matchMedia()
    // y el @media real que aplica display:none/flex en el CSS pueden
    // discrepar por un pixel bajo zoom del navegador o DPR fraccionario
    // (redondeos distintos, es un desacuerdo real y documentado entre
    // ambos motores). Con esa comparación, un desktop legítimo con zoom
    // ≠100% podía quedar bloqueado para siempre sin poder arrastrar nada.
    // Preguntarle directo al `display` calculado elimina la doble fuente
    // de verdad: es el MISMO CSS que ya decide si el panel se ve o no, así
    // que nunca puede discrepar consigo mismo. Solo aplica cuando hay
    // mediaQuery configurado (paneles sin gating siempre están activos).
    _isFloatingEligible() {
      if (!this.mediaQuery) return true;
      return getComputedStyle(this.el).display !== "none";
    }

    // Valor de tope actual — se recalcula en cada llamado (no se cachea)
    // porque options.minTop suele ser una función atada al alto real del
    // header, que puede cambiar entre un arrastre y el siguiente.
    _getMinTop() {
      const value = typeof this._minTopOption === "function" ? this._minTopOption() : this._minTopOption;
      return typeof value === "number" && !Number.isNaN(value) ? value : 0;
    }

    // Piso de "nacimiento" — si no se configuró uno propio (spawnMinTop),
    // cae al tope general de siempre, así que ventanas que no lo piden
    // (docks) se comportan exactamente igual que antes.
    _getSpawnMinTop() {
      if (this._spawnMinTopOption === undefined) return this._getMinTop();
      const value = typeof this._spawnMinTopOption === "function" ? this._spawnMinTopOption() : this._spawnMinTopOption;
      return typeof value === "number" && !Number.isNaN(value) ? value : this._getMinTop();
    }

    _undock() {
      if (this.mode === "floating" || this.mode === "maximized") return;
      if (!this._isFloatingEligible()) return;
      const rect = this.el.getBoundingClientRect();
      this.el.style.position = "fixed";
      // El piso de nacimiento (más generoso que el tope general de
      // arrastre) solo aplica ACÁ, en el instante en que la ventana se
      // despega por primera vez — una vez flotando, el usuario puede
      // arrastrarla hasta el tope general si quiere acercarla más al
      // header (ver applyMove en _wireDrag(), que sigue usando
      // _getMinTop() sin cambios).
      this.el.style.top = `${Math.max(rect.top, this._getSpawnMinTop())}px`;
      this.el.style.left = `${rect.left}px`;
      this.el.style.width = `${rect.width}px`;
      this.el.style.height = `${rect.height}px`;
      this.el.style.right = "auto";
      this.el.style.bottom = "auto";
      // El layout responsivo docked (ver style.css, @media por ancho de
      // pantalla) fija max-width/max-height/flex-basis en varios
      // breakpoints (ej. .panel--avatar llega a tener max-width:380px)
      // — sin anularlos acá, esos límites seguirían recortando el
      // tamaño real incluso con `width`/`height` inline ya explícitos,
      // y arrastrar/redimensionar se sentiría "trabado" en un eje.
      this.el.style.maxWidth = "none";
      this.el.style.maxHeight = "none";
      this.el.style.flex = "none";
      this.mode = "floating";
      this.el.classList.add("floating-window--floating");
      // z-index explícito apenas se despega — sin esto, un panel que
      // todavía no recibió NINGÚN pointerdown (ver _wireFocus) se queda
      // con z-index:auto, y "auto" pierde contra CUALQUIER otro panel
      // flotante que sí tenga un z-index numérico ya asignado, sin
      // importar el orden real de interacción. En la práctica: el
      // usuario arrastra la ventana A sobre la B, A ya tiene z-index de
      // su propio pointerdown de arrastre — pero si B nunca se tocó
      // todavía, B queda tapada Y ADEMÁS invisible al mouse en esa zona
      // (el navegador entrega el evento a A, que está "arriba" aunque
      // nadie la puso ahí a propósito) — exactamente el síntoma de
      // "ventana congelada / el contenedor bloquea el mouse".
      if (!this.el.style.zIndex) this.el.style.zIndex = String(nextZ());
    }

    // Arrastre con Pointer Events como mecanismo principal + un respaldo
    // por Mouse Events puro. El respaldo existe porque hay combinaciones
    // reales de Windows (ciertos drivers de touchpad/tableta/Windows
    // Ink instalados junto al navegador) donde `PointerEvent` existe
    // globalmente pero `pointerdown` no llega a disparar de forma
    // confiable sobre el mouse físico — mientras que los `MouseEvent`
    // de toda la vida sí. Con solo Pointer Events, esos casos se sentían
    // exactamente como "no pasa nada al arrastrar", sin ningún error en
    // consola que lo delatara. El respaldo se auto-desactiva solo: el
    // navegador manda un `mousedown` "de compatibilidad" inmediatamente
    // después de CUALQUIER `pointerdown` real de mouse (mismo click
    // físico) — esa ventana corta (`MOUSE_FALLBACK_WINDOW_MS`) es lo que
    // distingue ese eco de un `mousedown` genuino sin Pointer Events
    // detrás, así que nunca se procesa el mismo gesto dos veces.
    _wireDrag() {
      let startX = 0;
      let startY = 0;
      let startTop = 0;
      let startLeft = 0;
      let lastPointerDownAt = 0;

      const applyMove = (clientX, clientY) => {
        if (!this.dragState) return;
        const dx = clientX - startX;
        const dy = clientY - startY;
        const rect = this.el.getBoundingClientRect();
        const maxLeft = window.innerWidth - Math.min(rect.width, 120);
        const maxTop = window.innerHeight - 36; // deja al menos la barra de título visible
        const newLeft = clamp(startLeft + dx, -rect.width + 120, maxLeft);
        const newTop = clamp(startTop + dy, this._getMinTop(), maxTop);
        this.el.style.left = `${newLeft}px`;
        this.el.style.top = `${newTop}px`;
      };

      const endDrag = () => {
        if (!this.dragState) return;
        this.dragState = null;
        this.el.classList.remove("floating-window--dragging");
        this._persist();
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);

        const endTop = this.el.style.top;
        const endLeft = this.el.style.left;
        const originTop = `${startTop}px`;
        const originLeft = `${startLeft}px`;
        if (endTop === originTop && endLeft === originLeft) return; // no se movió realmente, nada que deshacer
        pushWindowUndo(`Mover ventana (${this.title || this.id || ""})`.trim(), () => {
          this.el.style.top = originTop;
          this.el.style.left = originLeft;
          this._persist();
        });
      };

      const onPointerMove = (event) => applyMove(event.clientX, event.clientY);
      const onPointerUp = (event) => {
        safePointerCapture(this.headerEl, event.pointerId, false);
        endDrag();
      };
      const onMouseMove = (event) => applyMove(event.clientX, event.clientY);
      const onMouseUp = () => endDrag();

      const beginDrag = (clientX, clientY) => {
        this._undock();
        const rect = this.el.getBoundingClientRect();
        startX = clientX;
        startY = clientY;
        startTop = rect.top;
        startLeft = rect.left;
        this.dragState = true;
        this.el.classList.add("floating-window--dragging");
      };

      // No arrastrar si el click empezó en uno de los botones de control
      // o en algún control interactivo que la cabecera ya trajera de
      // antes (ej. el chat no tiene ninguno, pero cualquier ventana
      // futura que reutilice un header con botones propios queda
      // cubierta acá igual). Arrastrar una ventana minimizada es válido
      // (reposiciona el "chip" compacto) — solo maximizada se excluye.
      const canStart = (event) =>
        !event.target.closest(".floating-window__btn, button, a, input, select, textarea") &&
        this._isFloatingEligible() &&
        this.mode !== "maximized";

      this.headerEl.addEventListener("pointerdown", (event) => {
        if (!canStart(event)) return;
        lastPointerDownAt = Date.now();
        event.preventDefault();
        beginDrag(event.clientX, event.clientY);
        safePointerCapture(this.headerEl, event.pointerId, true);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
      });

      this.headerEl.addEventListener("mousedown", (event) => {
        if (Date.now() - lastPointerDownAt < MOUSE_FALLBACK_WINDOW_MS) return;
        if (!canStart(event)) return;
        event.preventDefault();
        beginDrag(event.clientX, event.clientY);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });
    }

    // Redimensiona desde cualquiera de las 8 asas (_buildChrome las crea
    // todas). `dir` combina hasta dos letras ("n"/"s" + "e"/"w") — cada
    // una mueve el borde correspondiente; los bordes "n"/"w" además
    // desplazan top/left para que el borde OPUESTO quede fijo en su
    // lugar (redimensionar desde la esquina superior-izquierda no debe
    // mover la esquina inferior-derecha).
    // Mismo criterio dual (Pointer Events + respaldo por Mouse Events)
    // que _wireDrag() — ver el comentario largo ahí arriba.
    _wireResize() {
      let activeHandle = null;
      let startX = 0;
      let startY = 0;
      let startWidth = 0;
      let startHeight = 0;
      let startTop = 0;
      let startLeft = 0;
      let lastPointerDownAt = 0;

      const applyMove = (clientX, clientY) => {
        if (!this.resizeState) return;
        const dir = this.resizeState;
        const dx = clientX - startX;
        const dy = clientY - startY;
        const maxWidth = window.innerWidth - 20;
        const maxHeight = window.innerHeight - 20;

        if (dir.includes("e")) {
          this.el.style.width = `${clamp(startWidth + dx, this.minWidth, maxWidth)}px`;
        } else if (dir.includes("w")) {
          const newWidth = clamp(startWidth - dx, this.minWidth, maxWidth);
          this.el.style.width = `${newWidth}px`;
          this.el.style.left = `${startLeft + (startWidth - newWidth)}px`;
        }

        if (dir.includes("s")) {
          this.el.style.height = `${clamp(startHeight + dy, this.minHeight, maxHeight)}px`;
        } else if (dir.includes("n")) {
          let newHeight = clamp(startHeight - dy, this.minHeight, maxHeight);
          let newTop = startTop + (startHeight - newHeight);
          // Estirar desde el borde de arriba no puede empujar ese borde
          // por encima del tope (header) — si el cálculo normal lo
          // manda ahí, se lo clava en el tope y se recorta la altura
          // en consecuencia (el borde de ABAJO sigue fijo en su lugar,
          // mismo criterio que el resto de este bloque "n"/"s"/"e"/"w").
          const minTopVal = this._getMinTop();
          if (newTop < minTopVal) {
            newTop = minTopVal;
            newHeight = startTop + startHeight - newTop;
          }
          this.el.style.height = `${newHeight}px`;
          this.el.style.top = `${newTop}px`;
        }
      };

      const endResize = () => {
        if (!this.resizeState) return;
        this.resizeState = null;
        this.el.classList.remove("floating-window--resizing");
        activeHandle = null;
        this._persist();
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);

        const origin = { top: `${startTop}px`, left: `${startLeft}px`, width: `${startWidth}px`, height: `${startHeight}px` };
        const changed =
          this.el.style.top !== origin.top ||
          this.el.style.left !== origin.left ||
          this.el.style.width !== origin.width ||
          this.el.style.height !== origin.height;
        if (!changed) return;
        pushWindowUndo(`Redimensionar ventana (${this.title || this.id || ""})`.trim(), () => {
          this.el.style.top = origin.top;
          this.el.style.left = origin.left;
          this.el.style.width = origin.width;
          this.el.style.height = origin.height;
          this._persist();
        });
      };

      const onPointerMove = (event) => applyMove(event.clientX, event.clientY);
      const onPointerUp = (event) => {
        safePointerCapture(activeHandle, event.pointerId, false);
        endResize();
      };
      const onMouseMove = (event) => applyMove(event.clientX, event.clientY);
      const onMouseUp = () => endResize();

      const beginResize = (handle, clientX, clientY) => {
        this._undock();
        const rect = this.el.getBoundingClientRect();
        startX = clientX;
        startY = clientY;
        startWidth = rect.width;
        startHeight = rect.height;
        startTop = rect.top;
        startLeft = rect.left;
        this.resizeState = handle.dataset.resizeDir;
        activeHandle = handle;
        this.el.classList.add("floating-window--resizing");
      };

      const canStart = () => this._isFloatingEligible() && this.mode !== "maximized" && !this.minimized;

      this.resizeHandles.forEach((handle) => {
        handle.addEventListener("pointerdown", (event) => {
          if (!canStart()) return;
          lastPointerDownAt = Date.now();
          event.preventDefault();
          event.stopPropagation();
          beginResize(handle, event.clientX, event.clientY);
          safePointerCapture(handle, event.pointerId, true);
          window.addEventListener("pointermove", onPointerMove);
          window.addEventListener("pointerup", onPointerUp);
        });

        handle.addEventListener("mousedown", (event) => {
          if (Date.now() - lastPointerDownAt < MOUSE_FALLBACK_WINDOW_MS) return;
          if (!canStart()) return;
          event.preventDefault();
          event.stopPropagation();
          beginResize(handle, event.clientX, event.clientY);
          window.addEventListener("mousemove", onMouseMove);
          window.addEventListener("mouseup", onMouseUp);
        });
      });
    }

    // Colapsa el contenido dejando solo la cabecera visible — no toca
    // el DOM interno, solo fija la altura del contenedor raíz (medida
    // real de la cabecera, sea inyectada o reutilizada) y le esconde el
    // overflow (ver .floating-window--minimized en style.css). Guarda
    // la altura previa en _preMinimizeHeight para poder restaurarla
    // exacta al des-minimizar, sin importar si el elemento estaba
    // docked (altura por CSS) o floating/maximized (altura inline ya
    // explícita).
    toggleMinimize() {
      this.minimized = !this.minimized;
      if (this.minimized) {
        this._preMinimizeHeight = this.el.style.height || "";
        const headerHeight = this.headerEl.getBoundingClientRect().height;
        this.el.style.height = `${headerHeight}px`;
      } else {
        this.el.style.height = this._preMinimizeHeight || "";
      }
      this.el.classList.toggle("floating-window--minimized", this.minimized);
      if (this.minimizeBtn) {
        this.minimizeBtn.textContent = this.minimized ? "▭" : "─";
        this.minimizeBtn.setAttribute("aria-label", this.minimized ? "Restaurar" : "Minimizar");
        this.minimizeBtn.title = this.minimizeBtn.getAttribute("aria-label");
      }
      this._persist();
      // Sin este guard, restaurar el estado guardado al cargar la página
      // (ver _restorePersisted(), que también llama a toggleMinimize())
      // ensuciaría el historial de Ctrl+Z con una entrada que el usuario
      // nunca pidió.
      if (!this._restoring) {
        pushWindowUndo(`${this.minimized ? "Minimizar" : "Restaurar"} ventana (${this.title || this.id || ""})`.trim(), () =>
          this.toggleMinimize()
        );
      }
    }

    toggleMaximize() {
      if (this.mode === "maximized") {
        this.mode = this.beforeMaximize ? this.beforeMaximize.mode : "docked";
        this.el.classList.remove("floating-window--maximized");
        if (this.mode === "floating" && this.beforeMaximize) {
          this.el.style.top = this.beforeMaximize.top;
          this.el.style.left = this.beforeMaximize.left;
          this.el.style.width = this.beforeMaximize.width;
          this.el.style.height = this.beforeMaximize.height;
          this.el.classList.add("floating-window--floating");
        } else if (this.mode === "docked") {
          this._resetInlineLayout();
          this.el.classList.remove("floating-window--floating");
        }
        this.beforeMaximize = null;
      } else {
        // Si estaba minimizada, se restaura primero — maximizar y
        // minimizar a la vez no tiene sentido, y sin este paso
        // `beforeMaximize` capturaría la altura COLAPSADA como si
        // fuera el tamaño "normal" al que hay que volver después.
        if (this.minimized) this.toggleMinimize();
        this.beforeMaximize = {
          mode: this.mode,
          top: this.el.style.top,
          left: this.el.style.left,
          width: this.el.style.width,
          height: this.el.style.height,
        };
        this.mode = "maximized";
        this.el.style.zIndex = String(nextZ());
        // Mismo motivo que en _undock(): el max-width/max-height
        // responsivo del layout ACOPLADO (ej. .panel--avatar llega a
        // 380-460px en varios breakpoints) sigue vivo si la ventana
        // nunca pasó por _undock() (maximizar de un tirón sin haber
        // arrastrado antes) — sin limpiarlo acá también, "maximizar" se
        // quedaba clavado en el tamaño acoplado viejo en vez de llenar
        // el inset:14px de .floating-window__maximized, dejando un
        // recuadro chico pegado a una esquina en vez de la ventana
        // llena (el bug real detrás de "cruza los límites / capas
        // extrañas" reportado).
        this.el.style.maxWidth = "none";
        this.el.style.maxHeight = "none";
        this.el.style.flex = "none";
        this.el.classList.add("floating-window--maximized");
        this.el.classList.remove("floating-window--floating");
      }
      if (this.maximizeBtn) {
        const isMax = this.mode === "maximized";
        this.maximizeBtn.textContent = isMax ? "❐" : "▢";
        this.maximizeBtn.setAttribute("aria-label", isMax ? "Restaurar tamaño" : "Maximizar");
        this.maximizeBtn.title = this.maximizeBtn.getAttribute("aria-label");
      }
      this._persist();
      if (!this._restoring) {
        const isMax = this.mode === "maximized";
        pushWindowUndo(`${isMax ? "Maximizar" : "Restaurar"} ventana (${this.title || this.id || ""})`.trim(), () =>
          this.toggleMaximize()
        );
      }
    }

    close() {
      this.el.classList.add("floating-window--closed");
      if (this.onClose) this.onClose();
    }

    _persist() {
      if (!this.id) return;
      // Si está minimizada, `this.el.style.height` es la altura
      // COLAPSADA (solo la cabecera) — se guarda la altura real
      // (_preMinimizeHeight) para que un reload + restore vuelva
      // siempre al tamaño expandido correcto, nunca a la versión
      // achicada.
      const heightToSave = this.minimized ? this._preMinimizeHeight || "" : this.el.style.height;
      savePersisted(this.id, {
        mode: this.mode,
        minimized: this.minimized,
        top: this.el.style.top,
        left: this.el.style.left,
        width: this.el.style.width,
        height: heightToSave,
      });
    }

    _restorePersisted() {
      const saved = loadPersisted(this.id);
      if (!saved || saved.mode === "docked") return;
      if (!this._isFloatingEligible()) return;
      // Evita que restaurar el estado guardado (al recargar la página)
      // dispare pushWindowUndo() desde toggleMinimize()/toggleMaximize()
      // más abajo — esto no es una acción del usuario en esta sesión.
      this._restoring = true;
      if (saved.mode === "floating" && saved.top && saved.left) {
        this.el.style.position = "fixed";
        // Una posición guardada de ANTES de que existiera este tope (u
        // obtenida con el header en otro alto/breakpoint, o arrastrada
        // por el usuario pegada al límite general en una sesión previa)
        // podría reaparecer con poco aire bajo el header — se corrige
        // acá con el mismo piso generoso de "nacimiento" que _undock(),
        // porque reabrir/recargar cuenta como "abrir la ventana" tanto
        // como la primera vez (pedido explícito: "al crear O ABRIR").
        const savedTop = parseFloat(saved.top);
        const spawnMinTopVal = this._getSpawnMinTop();
        this.el.style.top = !Number.isNaN(savedTop) && savedTop < spawnMinTopVal ? `${spawnMinTopVal}px` : saved.top;
        this.el.style.left = saved.left;
        if (saved.width) this.el.style.width = saved.width;
        if (saved.height) this.el.style.height = saved.height;
        // Mismo motivo que en _undock(): restaurar directo a "floating"
        // en una recarga nunca pasa por _undock(), así que sin esto el
        // max-width/max-height responsivo del layout docked seguiría
        // recortando el tamaño restaurado — y lo mismo para el z-index
        // (ver el comentario al final de _undock()): sin asignar uno acá
        // también, una ventana restaurada en floating con z-index:auto
        // podía perder contra cualquier otra que sí tuviera uno numérico.
        this.el.style.maxWidth = "none";
        this.el.style.maxHeight = "none";
        this.el.style.flex = "none";
        this.mode = "floating";
        this.el.classList.add("floating-window--floating");
        if (!this.el.style.zIndex) this.el.style.zIndex = String(nextZ());
      } else if (saved.mode === "maximized") {
        this.toggleMaximize();
      }
      if (saved.minimized) this.toggleMinimize();
      this._restoring = false;
    }
  }

  global.MiikaeruFloatingWindow = {
    enable(el, options) {
      if (!el) return null;
      return new FloatingWindow(el, options || {});
    },
  };
})(typeof window !== "undefined" ? window : this);
