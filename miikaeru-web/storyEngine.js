// ===================================================
// MIIKAERU STORY ENGINE — Modal de Lore / Cuento Interactivo
// ===================================================
// Mismo patrón de "punto de enchufe" que MiikaeruHub en app.js: un único
// objeto expuesto en window con un método de entrada. Vive en su propio
// archivo (pedido explícito) y a propósito NO comparte el closure de
// DOMContentLoaded de app.js — por eso toma sus propios DOM refs por id
// en cada llamada en vez de guardarlos una sola vez arriba (mismo
// criterio defensivo que initAvatar3D() en app.js) y recibe el nivel del
// Operador como parámetro en vez de leer `state` directamente.
//
// Se carga con <script src="storyEngine.js"> DESPUÉS de app.js en
// index.html — app.js llama a
// `window.MiikaeruStoryEngine.alHacerClicEnAvatarLeon({ nivel: state.level })`
// desde el listener de click del avatar/León.
const MiikaeruStoryEngine = (() => {
  const DATA_URL = "data/storyData.json";
  const MENSAJE_SIN_DESBLOQUEAR = "Aún no hay registros de lore desbloqueados.";

  let capitulos = null;
  let fetchEnCurso = null;
  let listenersListos = false;

  function obtenerRefs() {
    return {
      modal: document.getElementById("story-modal"),
      cerrarX: document.getElementById("story-modal-close"),
      cerrarBtn: document.getElementById("story-modal-close-btn"),
      tabs: document.getElementById("story-modal-tabs"),
      titulo: document.getElementById("story-modal-chapter-title"),
      rango: document.getElementById("story-modal-chapter-rank"),
      imagen: document.getElementById("story-modal-image"),
      galeria: document.getElementById("story-modal-gallery"),
      cuerpo: document.getElementById("story-modal-body"),
      misterioTexto: document.getElementById("story-modal-mystery-text"),
      pistaTexto: document.getElementById("story-modal-clue-text"),
    };
  }

  // Los listeners de cierre (X, botón, click fuera, Escape) se enganchan
  // UNA sola vez — no en cada apertura del modal, para no acumular
  // listeners duplicados cada vez que se hace click en el León.
  function asegurarListeners(refs) {
    if (listenersListos || !refs.modal) return;

    const cerrar = () => {
      refs.modal.hidden = true;
    };

    if (refs.cerrarX) refs.cerrarX.addEventListener("click", cerrar);
    if (refs.cerrarBtn) refs.cerrarBtn.addEventListener("click", cerrar);
    refs.modal.addEventListener("click", (event) => {
      if (event.target === refs.modal) cerrar();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !refs.modal.hidden) cerrar();
    });

    listenersListos = true;
  }

  // data/storyData.json se trae una sola vez (best effort) y se cachea en
  // memoria — no hace falta localStorage/IndexedDB porque el archivo es
  // estático y ya vive detrás del Service Worker (Cache First, ver
  // sw.js). Si la red falla o el archivo no existe, resuelve con un
  // array vacío en vez de rechazar — fallback pedido explícitamente.
  function cargarStoryData() {
    if (capitulos) return Promise.resolve(capitulos);
    if (!fetchEnCurso) {
      fetchEnCurso = fetch(DATA_URL)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          capitulos = Array.isArray(data) ? data : [];
          return capitulos;
        })
        .catch((err) => {
          console.warn("StoryEngine: no se pudo cargar data/storyData.json (se muestra fallback):", err);
          capitulos = [];
          return capitulos;
        });
    }
    return fetchEnCurso;
  }

  // El capítulo desbloqueado de mayor nivel_requerido — mismo criterio de
  // "lo más reciente que ya alcanzaste" que usan los tiers de Miika Pass.
  function capituloMasAltoDesbloqueado(lista, nivel) {
    const desbloqueados = lista.filter((capitulo) => nivel >= capitulo.nivel_requerido);
    if (!desbloqueados.length) return null;
    return desbloqueados.reduce((mejor, capitulo) => (capitulo.nivel_requerido > mejor.nivel_requerido ? capitulo : mejor));
  }

  // Fallback de imagen: las ilustraciones reales todavía no existen en el
  // repo — onerror oculta la imagen sola sin romper el layout del modal,
  // mismo criterio de "mejor esfuerzo" que ya usa initAvatar3D() con el
  // .glb del avatar de escritorio. Compartida entre la imagen principal y
  // los clicks de la galería.
  function fijarImagenPrincipal(refs, src, textoAlt) {
    refs.imagen.onerror = () => {
      refs.imagen.hidden = true;
    };
    refs.imagen.onload = () => {
      refs.imagen.hidden = false;
    };
    refs.imagen.hidden = true;
    refs.imagen.src = src;
    refs.imagen.alt = textoAlt || "";
  }

  function renderizarTabs(refs, lista, idActivo, nivel) {
    refs.tabs.innerHTML = "";
    lista.forEach((capitulo) => {
      const desbloqueado = nivel >= capitulo.nivel_requerido;
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className =
        "story-modal__tab" +
        (capitulo.id === idActivo ? " story-modal__tab--active" : "") +
        (desbloqueado ? "" : " story-modal__tab--locked");
      tab.disabled = !desbloqueado;

      const lineaRango = document.createElement("span");
      lineaRango.textContent = capitulo.rango;
      const lineaNivel = document.createElement("span");
      lineaNivel.textContent = desbloqueado ? `Nv. ${capitulo.nivel_requerido}` : `🔒 Nv. ${capitulo.nivel_requerido}`;

      tab.append(lineaRango, lineaNivel);
      if (desbloqueado) tab.addEventListener("click", () => renderizarCapitulo(refs, capitulo.id, nivel));
      refs.tabs.appendChild(tab);
    });
  }

  function renderizarCapitulo(refs, idCapitulo, nivel) {
    if (!capitulos) return;
    const capitulo = capitulos.find((entrada) => entrada.id === idCapitulo);
    if (!capitulo) return; // fallback silencioso: id inexistente, no rompe el modal ya abierto

    refs.titulo.textContent = capitulo.titulo_capitulo || "";
    refs.rango.textContent = capitulo.rango ? `${capitulo.rango} · Nv. ${capitulo.nivel_requerido}` : "";

    fijarImagenPrincipal(refs, capitulo.imagen_story, capitulo.titulo_capitulo);

    // Galería secundaria (imagenes_adicionales) — cada miniatura promueve
    // su propia imagen a la principal al hacer click. onerror la oculta
    // sola sin dejar un hueco roto en la fila.
    refs.galeria.innerHTML = "";
    (capitulo.imagenes_adicionales || []).forEach((extra) => {
      const miniatura = document.createElement("img");
      miniatura.className = "story-modal__gallery-thumb";
      miniatura.src = extra.src;
      miniatura.alt = extra.rol || "";
      miniatura.title = extra.rol || "";
      miniatura.onerror = () => {
        miniatura.style.display = "none";
      };
      miniatura.addEventListener("click", () => fijarImagenPrincipal(refs, extra.src, extra.rol || capitulo.titulo_capitulo));
      refs.galeria.appendChild(miniatura);
    });

    refs.cuerpo.innerHTML = "";
    (capitulo.texto_modal || []).forEach((parrafo) => {
      const p = document.createElement("p");
      p.textContent = parrafo;
      refs.cuerpo.appendChild(p);
    });
    refs.cuerpo.scrollTop = 0;

    refs.misterioTexto.textContent = capitulo.misterio_revelado || "";
    refs.pistaTexto.textContent = capitulo.siguiente_pista || "";

    renderizarTabs(refs, capitulos, idCapitulo, nivel);
  }

  // Fallback cuando no hay NINGÚN capítulo desbloqueado para el nivel
  // dado — hoy no debería pasar (el capítulo 1 pide nivel 1, que todo
  // Operador ya tiene desde el registro), pero queda cubierto por si
  // algún día se sube un primer capítulo con nivel_requerido > 1, o si
  // llega un nivel inválido/negativo desde afuera.
  function mostrarSinDesbloquear(refs) {
    refs.titulo.textContent = MENSAJE_SIN_DESBLOQUEAR;
    refs.rango.textContent = "";
    refs.imagen.hidden = true;
    refs.galeria.innerHTML = "";
    refs.cuerpo.innerHTML = "";
    refs.misterioTexto.textContent = "";
    refs.pistaTexto.textContent = "";
    refs.tabs.innerHTML = "";
  }

  // ---------------- Punto de entrada público ----------------
  // usuarioActual: objeto con forma { nivel: number }. Si falta, no es un
  // objeto, o `nivel` no es un número finito, se asume nivel 1 en vez de
  // romper — fallback de "nivel incorrecto" pedido explícitamente.
  function alHacerClicEnAvatarLeon(usuarioActual) {
    const refs = obtenerRefs();
    if (!refs.modal) {
      console.warn("StoryEngine: #story-modal no existe en el DOM todavía.");
      return;
    }
    asegurarListeners(refs);

    const nivel = usuarioActual && Number.isFinite(usuarioActual.nivel) ? usuarioActual.nivel : 1;

    refs.modal.hidden = false;
    cargarStoryData()
      .then((lista) => {
        const masAlto = capituloMasAltoDesbloqueado(lista, nivel);
        if (!masAlto) {
          mostrarSinDesbloquear(refs);
          return;
        }
        renderizarCapitulo(refs, masAlto.id, nivel);
      })
      .catch((err) => {
        // Red de seguridad final: cargarStoryData() ya atrapa sus propios
        // errores y resuelve con [], así que esto solo cubriría un bug
        // futuro de render — no debería dispararse en uso normal.
        console.warn("StoryEngine: error inesperado al abrir el Modal de Lore:", err);
        mostrarSinDesbloquear(refs);
      });
  }

  return { alHacerClicEnAvatarLeon };
})();

window.MiikaeruStoryEngine = MiikaeruStoryEngine;
