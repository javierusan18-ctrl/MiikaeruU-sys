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
//
// El modal tiene DOS vistas que comparten los mismos elementos de imagen/
// galería/cuerpo (tabs, imagen principal, galería secundaria, cuerpo de
// texto): "Capítulos" (narrativa de storyData.json, con desbloqueo por
// nivel, comportamiento original) y "Personajes" (enciclopedia de
// entidades de loreCharacters.json — Miikaeru, Metrakaela, Fesha, Mijashi,
// Demiure, Badas —, siempre disponible, sin desbloqueo por nivel porque
// son datos de referencia, no progreso narrativo). El bloque
// "MISTERIO REVELADO"/"PRÓXIMA PISTA" es propio de los capítulos y se
// oculta en la vista de Personajes para no mostrar campos vacíos.
const MiikaeruStoryEngine = (() => {
  const DATA_URL = "data/storyData.json";
  const PERSONAJES_URL = "data/loreCharacters.json";
  const MENSAJE_SIN_DESBLOQUEAR = "Aún no hay registros de lore desbloqueados.";

  let capitulos = null;
  let fetchCapitulosEnCurso = null;
  let personajes = null;
  let fetchPersonajesEnCurso = null;
  let listenersListos = false;

  // Vista activa y último nivel conocido — recordados a nivel de módulo
  // porque los botones del selector de vista se enganchan UNA sola vez
  // (ver asegurarListeners) y necesitan poder reabrir la vista Capítulos
  // con el nivel correcto sin depender de la llamada original que abrió
  // el modal.
  let vistaActual = "capitulos";
  let nivelRecordado = 1;

  function obtenerRefs() {
    return {
      modal: document.getElementById("story-modal"),
      cerrarX: document.getElementById("story-modal-close"),
      cerrarBtn: document.getElementById("story-modal-close-btn"),
      btnVistaCapitulos: document.getElementById("story-modal-view-chapters"),
      btnVistaPersonajes: document.getElementById("story-modal-view-characters"),
      tabs: document.getElementById("story-modal-tabs"),
      titulo: document.getElementById("story-modal-chapter-title"),
      rango: document.getElementById("story-modal-chapter-rank"),
      imagen: document.getElementById("story-modal-image"),
      galeria: document.getElementById("story-modal-gallery"),
      cuerpo: document.getElementById("story-modal-body"),
      misterioBox: document.querySelector(".story-modal__mystery"),
      pistaBox: document.querySelector(".story-modal__clue"),
      misterioTexto: document.getElementById("story-modal-mystery-text"),
      pistaTexto: document.getElementById("story-modal-clue-text"),
    };
  }

  // Los listeners de cierre (X, botón, click fuera, Escape) y del selector
  // de vista se enganchan UNA sola vez — no en cada apertura del modal,
  // para no acumular listeners duplicados cada vez que se hace click en
  // el León.
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

    if (refs.btnVistaCapitulos) {
      refs.btnVistaCapitulos.addEventListener("click", () => mostrarVistaCapitulos(refs));
    }
    if (refs.btnVistaPersonajes) {
      refs.btnVistaPersonajes.addEventListener("click", () => mostrarVistaPersonajes(refs));
    }

    listenersListos = true;
  }

  function marcarVistaActiva(refs) {
    if (refs.btnVistaCapitulos) {
      refs.btnVistaCapitulos.classList.toggle("story-modal__view-btn--active", vistaActual === "capitulos");
    }
    if (refs.btnVistaPersonajes) {
      refs.btnVistaPersonajes.classList.toggle("story-modal__view-btn--active", vistaActual === "personajes");
    }
    // El bloque Misterio/Pista es propio de los capítulos — no aplica a
    // la ficha de un Personaje, así que se oculta entero en esa vista en
    // vez de dejarlo vacío.
    if (refs.misterioBox) refs.misterioBox.hidden = vistaActual !== "capitulos";
    if (refs.pistaBox) refs.pistaBox.hidden = vistaActual !== "capitulos";
  }

  // data/storyData.json y data/loreCharacters.json se traen una sola vez
  // cada uno (best effort) y se cachean en memoria — no hace falta
  // localStorage/IndexedDB porque son archivos estáticos y ya viven
  // detrás del Service Worker (Cache First, ver sw.js). Si la red falla o
  // el archivo no existe, resuelven con un array vacío en vez de
  // rechazar — fallback pedido explícitamente para storyData.json y
  // aplicado por consistencia a loreCharacters.json.
  function cargarStoryData() {
    if (capitulos) return Promise.resolve(capitulos);
    if (!fetchCapitulosEnCurso) {
      fetchCapitulosEnCurso = fetch(DATA_URL)
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
    return fetchCapitulosEnCurso;
  }

  function cargarPersonajes() {
    if (personajes) return Promise.resolve(personajes);
    if (!fetchPersonajesEnCurso) {
      fetchPersonajesEnCurso = fetch(PERSONAJES_URL)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          personajes = Array.isArray(data) ? data : [];
          return personajes;
        })
        .catch((err) => {
          console.warn("StoryEngine: no se pudo cargar data/loreCharacters.json (se muestra fallback):", err);
          personajes = [];
          return personajes;
        });
    }
    return fetchPersonajesEnCurso;
  }

  // El capítulo desbloqueado de mayor nivel_requerido — mismo criterio de
  // "lo más reciente que ya alcanzaste" que usan los tiers de Miika Pass.
  function capituloMasAltoDesbloqueado(lista, nivel) {
    const desbloqueados = lista.filter((capitulo) => nivel >= capitulo.nivel_requerido);
    if (!desbloqueados.length) return null;
    return desbloqueados.reduce((mejor, capitulo) => (capitulo.nivel_requerido > mejor.nivel_requerido ? capitulo : mejor));
  }

  // Fallback de imagen: onerror oculta la imagen sola sin romper el
  // layout del modal, mismo criterio de "mejor esfuerzo" que ya usa
  // initAvatar3D() con el .glb del avatar de escritorio. Compartida entre
  // la imagen principal y los clicks de la galería, en ambas vistas.
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

  function renderizarGaleria(refs, imagenesAdicionales, tituloAltFallback) {
    refs.galeria.innerHTML = "";
    (imagenesAdicionales || []).forEach((extra) => {
      const miniatura = document.createElement("img");
      miniatura.className = "story-modal__gallery-thumb";
      miniatura.src = extra.src;
      miniatura.alt = extra.rol || "";
      miniatura.title = extra.rol || "";
      miniatura.onerror = () => {
        miniatura.style.display = "none";
      };
      miniatura.addEventListener("click", () => fijarImagenPrincipal(refs, extra.src, extra.rol || tituloAltFallback));
      refs.galeria.appendChild(miniatura);
    });
  }

  // ---------------- Vista: Capítulos (narrativa) ----------------

  function renderizarTabsCapitulos(refs, lista, idActivo, nivel) {
    refs.tabs.innerHTML = "";
    lista.forEach((capitulo) => {
      const desbloqueado = nivel >= capitulo.nivel_requerido;
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className =
        "story-modal__tab" +
        (capitulo.id === idActivo ? " story-modal__tab--active" : "") +
        (desbloqueado ? "" : " story-modal__tab--locked");

      const lineaRango = document.createElement("span");
      lineaRango.textContent = capitulo.rango;
      const lineaNivel = document.createElement("span");
      lineaNivel.textContent = desbloqueado ? `Nv. ${capitulo.nivel_requerido}` : `🔒 Nv. ${capitulo.nivel_requerido}`;

      tab.append(lineaRango, lineaNivel);
      // La pestaña queda clickeable incluso bloqueada — pedido explícito
      // de "Lore Oculto": el Operador puede navegar la galería de
      // portadas/miniaturas de TODOS los capítulos como vista previa,
      // aunque el texto de los todavía no alcanzados se muestre en
      // spoiler (ver renderizarCapitulo).
      tab.addEventListener("click", () => renderizarCapitulo(refs, capitulo.id, nivel));
      refs.tabs.appendChild(tab);
    });
  }

  function renderizarCapitulo(refs, idCapitulo, nivel) {
    if (!capitulos) return;
    const capitulo = capitulos.find((entrada) => entrada.id === idCapitulo);
    if (!capitulo) return; // fallback silencioso: id inexistente, no rompe el modal ya abierto

    const desbloqueado = nivel >= capitulo.nivel_requerido;

    refs.titulo.textContent = capitulo.titulo_capitulo || "";
    refs.rango.textContent = capitulo.rango ? `${capitulo.rango} · Nv. ${capitulo.nivel_requerido}` : "";

    // La imagen de portada y la galería secundaria se muestran SIEMPRE,
    // estén o no desbloqueados — son la "vista previa ilustrativa" que
    // pide el Lore Oculto: se puede curiosear el arte de un capítulo
    // futuro sin poder leer todavía su historia.
    fijarImagenPrincipal(refs, capitulo.imagen_story, capitulo.titulo_capitulo);
    renderizarGaleria(refs, capitulo.imagenes_adicionales, capitulo.titulo_capitulo);

    refs.cuerpo.classList.toggle("story-modal__body--locked", !desbloqueado);
    refs.cuerpo.innerHTML = "";
    (capitulo.texto_modal || []).forEach((parrafo) => {
      const p = document.createElement("p");
      p.textContent = parrafo;
      refs.cuerpo.appendChild(p);
    });

    if (!desbloqueado) {
      // El texto real queda montado en el DOM (para que el blur de
      // .story-modal__body--locked tenga sobre qué difuminar, efecto
      // "spoiler" real y no un simple placeholder vacío) y por encima se
      // superpone el aviso de bloqueo con el nivel que hace falta.
      const overlay = document.createElement("div");
      overlay.className = "story-modal__spoiler-overlay";
      overlay.innerHTML = `<span class="story-modal__spoiler-icon">🔒</span><span>Alcanza el Nivel ${capitulo.nivel_requerido} para desbloquear este registro</span>`;
      refs.cuerpo.appendChild(overlay);
    }
    refs.cuerpo.scrollTop = 0;

    refs.misterioTexto.textContent = capitulo.misterio_revelado || "";
    refs.pistaTexto.textContent = capitulo.siguiente_pista || "";
    // El Misterio Revelado y la Próxima Pista son, por definición, spoilers
    // de la propia historia — se ocultan enteros mientras el capítulo no
    // esté desbloqueado, en vez de difuminarlos también.
    if (refs.misterioBox) refs.misterioBox.hidden = !desbloqueado;
    if (refs.pistaBox) refs.pistaBox.hidden = !desbloqueado;

    renderizarTabsCapitulos(refs, capitulos, idCapitulo, nivel);
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

  function mostrarVistaCapitulos(refs) {
    vistaActual = "capitulos";
    marcarVistaActiva(refs);
    cargarStoryData().then((lista) => {
      const masAlto = capituloMasAltoDesbloqueado(lista, nivelRecordado);
      if (!masAlto) {
        mostrarSinDesbloquear(refs);
        return;
      }
      renderizarCapitulo(refs, masAlto.id, nivelRecordado);
    });
  }

  // ---------------- Vista: Personajes (enciclopedia) ----------------
  // Sin desbloqueo por nivel — son fichas de referencia del universo, no
  // progreso narrativo, así que las 6 quedan disponibles desde el inicio.

  function renderizarTabsPersonajes(refs, lista, idActivo) {
    refs.tabs.innerHTML = "";
    lista.forEach((personaje) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "story-modal__tab" + (personaje.id === idActivo ? " story-modal__tab--active" : "");

      const lineaNombre = document.createElement("span");
      lineaNombre.textContent = personaje.nombre;
      const lineaRango = document.createElement("span");
      lineaRango.textContent = personaje.rango || "";

      tab.append(lineaNombre, lineaRango);
      tab.addEventListener("click", () => renderizarPersonaje(refs, personaje.id));
      refs.tabs.appendChild(tab);
    });
  }

  function renderizarPersonaje(refs, idPersonaje) {
    if (!personajes) return;
    const personaje = personajes.find((entrada) => entrada.id === idPersonaje);
    if (!personaje) return; // fallback silencioso: id inexistente, no rompe el modal ya abierto

    refs.titulo.textContent = personaje.nombre ? `${personaje.nombre} — ${personaje.titulo || ""}` : personaje.titulo || "";
    refs.rango.textContent = personaje.rango || "";

    fijarImagenPrincipal(refs, personaje.imagen_principal, personaje.nombre);
    renderizarGaleria(refs, personaje.galeria, personaje.nombre);

    refs.cuerpo.innerHTML = "";
    (personaje.descripcion || []).forEach((parrafo) => {
      const p = document.createElement("p");
      p.textContent = parrafo;
      refs.cuerpo.appendChild(p);
    });
    refs.cuerpo.scrollTop = 0;

    renderizarTabsPersonajes(refs, personajes, idPersonaje);
  }

  function mostrarVistaPersonajes(refs) {
    vistaActual = "personajes";
    marcarVistaActiva(refs);
    cargarPersonajes().then((lista) => {
      if (!lista.length) return; // fallback silencioso: sin datos, el modal queda abierto pero vacío
      renderizarPersonaje(refs, lista[0].id);
    });
  }

  // ---------------- Punto de entrada público ----------------
  // usuarioActual: objeto con forma { nivel: number }. Si falta, no es un
  // objeto, o `nivel` no es un número finito, se asume nivel 1 en vez de
  // romper — fallback de "nivel incorrecto" pedido explícitamente.
  // El modal siempre abre en la vista Capítulos (comportamiento original
  // sin cambios); el Operador cambia a Personajes manualmente con el
  // selector de vista.
  function alHacerClicEnAvatarLeon(usuarioActual) {
    const refs = obtenerRefs();
    if (!refs.modal) {
      console.warn("StoryEngine: #story-modal no existe en el DOM todavía.");
      return;
    }
    asegurarListeners(refs);

    nivelRecordado = usuarioActual && Number.isFinite(usuarioActual.nivel) ? usuarioActual.nivel : 1;

    refs.modal.hidden = false;
    mostrarVistaCapitulos(refs);
  }

  return { alHacerClicEnAvatarLeon };
})();

window.MiikaeruStoryEngine = MiikaeruStoryEngine;
