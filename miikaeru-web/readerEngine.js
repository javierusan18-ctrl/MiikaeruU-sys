// ===================================================
// MIIKAERU READER ENGINE — Lectura Inmersiva de Japonés
// ===================================================
// Módulo compartido (mismo patrón "punto de enchufe" que MiikaeruHub/
// MiikaeruStoryEngine) usado tanto por el Módulo de Aprendizaje (Japonés
// AI Coach, dentro del closure de app.js) como por el Modal de Lore
// (storyEngine.js) — ninguno de los dos comparte closure con el otro, así
// que esta lógica vive en su propio archivo, sin estado propio salvo la
// cola de auto-lectura en curso (para poder cancelarla desde cualquiera
// de los dos consumidores sin pisarse).
//
// Contrato de datos de una "línea" de lectura:
//   { segments: [ { text: "王国", reading: "おうこく" }, { text: "は" }, ... ],
//     traduccion: "..." }
// `reading` ausente/null en un segmento = texto plano (partícula, signo de
// puntuación, katakana de nombre propio) sin furigana encima.
const MiikaeruReader = (() => {
  let autoReadActivo = false;
  let autoReadCancelado = false;

  function hayTTS() {
    return "speechSynthesis" in window;
  }

  // Chrome/Chromium tiene un bug conocido (desktop y Android): un solo
  // SpeechSynthesisUtterance largo se corta a mitad de camino, sobre todo
  // pasados ~15s o con la pestaña sin foco, porque el motor deja de
  // recibir el "keep-alive" interno que necesita para utterances
  // extensos. La solución real (no un parche cosmético) es nunca pasarle
  // un texto largo de una sola vez: se parte en oraciones cortas por los
  // delimitadores japoneses (。！？) y se reproducen en cola, una
  // SpeechSynthesisUtterance por oración — cada una dura poco, así que
  // nunca llega a activar el bug, sin importar cuán larga sea la línea
  // completa original.
  function partirEnOraciones(texto) {
    const oraciones = texto.split(/(?<=[。！？])/).map((s) => s.trim()).filter(Boolean);
    return oraciones.length ? oraciones : [texto];
  }

  function hablarOracion(oracion) {
    return new Promise((resolve) => {
      if (!hayTTS() || !oracion) {
        setTimeout(resolve, Math.max(600, oracion.length * 110));
        return;
      }
      const utterance = new SpeechSynthesisUtterance(oracion);
      utterance.lang = "ja-JP";
      utterance.rate = 0.92; // levemente más lento que el default — más fácil de seguir para un estudiante
      utterance.onend = resolve;
      utterance.onerror = resolve; // no trabar el modo automático si la voz falla a mitad de camino
      window.speechSynthesis.speak(utterance);
    });
  }

  // Reproduce una línea completa (posiblemente varias oraciones)
  // encolando una SpeechSynthesisUtterance corta por oración en vez de
  // una sola larga — ver partirEnOraciones()/hablarOracion() arriba.
  // Sin voz nativa disponible, resuelve la promesa igual tras una
  // duración estimada (~110ms/carácter) para que el modo automático siga
  // avanzando sin trabarse.
  async function reproducirLinea(texto) {
    if (!texto) return;
    window.speechSynthesis && window.speechSynthesis.cancel();
    for (const oracion of partirEnOraciones(texto)) {
      await hablarOracion(oracion);
    }
  }

  function textoPlanoDeLinea(linea) {
    return (linea.segments || []).map((s) => s.text).join("");
  }

  // Construye el <ruby> de una línea: cada segmento con `reading` se
  // envuelve en ruby/rt; sin `reading`, texto plano suelto — así una
  // partícula o signo de puntuación no queda con un <rt> vacío flotando
  // encima.
  function crearElementoLinea(linea, indice) {
    const fila = document.createElement("div");
    fila.className = "reader-line";
    fila.dataset.readerIndex = String(indice);

    const audioBtn = document.createElement("button");
    audioBtn.type = "button";
    audioBtn.className = "reader-line__audio";
    audioBtn.setAttribute("aria-label", "Escuchar esta línea");
    audioBtn.textContent = "🔊";
    audioBtn.addEventListener("click", () => reproducirLinea(textoPlanoDeLinea(linea)));

    const textoJp = document.createElement("p");
    textoJp.className = "reader-line__jp";
    (linea.segments || []).forEach((seg) => {
      if (seg.reading) {
        const ruby = document.createElement("ruby");
        ruby.append(document.createTextNode(seg.text));
        const rt = document.createElement("rt");
        rt.textContent = seg.reading;
        ruby.appendChild(rt);
        textoJp.appendChild(ruby);
      } else {
        textoJp.appendChild(document.createTextNode(seg.text));
      }
    });

    const textoEs = document.createElement("p");
    textoEs.className = "reader-line__es";
    textoEs.textContent = linea.traduccion || "";

    fila.append(audioBtn, textoJp, textoEs);
    return fila;
  }

  // Punto de entrada público: pinta las líneas dentro de `contenedor` y
  // engancha el botón de Lectura Automática (`botonAuto`, opcional — si
  // no se pasa, el consumidor no ofrece ese modo). Devuelve un objeto con
  // `detener()` para que el consumidor pueda cortar la lectura en curso
  // al cerrar su modal/vista sin dejar una voz hablando de fondo.
  function crearLector(contenedor, lineas, botonAuto) {
    contenedor.innerHTML = "";
    autoReadCancelado = true; // cualquier auto-lectura anterior (de otra línea/vista) queda cortada
    autoReadActivo = false;

    (lineas || []).forEach((linea, i) => contenedor.appendChild(crearElementoLinea(linea, i)));

    async function iniciarAutoLectura() {
      if (autoReadActivo) return;
      autoReadActivo = true;
      autoReadCancelado = false;
      if (botonAuto) botonAuto.textContent = "⏹ Detener lectura";

      for (let i = 0; i < lineas.length; i++) {
        if (autoReadCancelado) break;
        const fila = contenedor.querySelector(`[data-reader-index="${i}"]`);
        contenedor.querySelectorAll(".reader-line--active").forEach((el) => el.classList.remove("reader-line--active"));
        if (fila) {
          fila.classList.add("reader-line--active");
          fila.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        await reproducirLinea(textoPlanoDeLinea(lineas[i]));
      }

      contenedor.querySelectorAll(".reader-line--active").forEach((el) => el.classList.remove("reader-line--active"));
      autoReadActivo = false;
      if (botonAuto) botonAuto.textContent = "▶ Lectura automática";
    }

    function detener() {
      autoReadCancelado = true;
      autoReadActivo = false;
      if (hayTTS()) window.speechSynthesis.cancel();
      contenedor.querySelectorAll(".reader-line--active").forEach((el) => el.classList.remove("reader-line--active"));
      if (botonAuto) botonAuto.textContent = "▶ Lectura automática";
    }

    if (botonAuto) {
      botonAuto.textContent = "▶ Lectura automática";
      botonAuto.onclick = () => (autoReadActivo ? detener() : iniciarAutoLectura());
    }

    return { detener };
  }

  return { crearLector };
})();

window.MiikaeruReader = MiikaeruReader;
