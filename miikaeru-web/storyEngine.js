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

  // Instancia activa del lector de Lectura Inmersiva (ver readerEngine.js)
  // — se guarda para poder cortarla (detener audio + resaltado en curso)
  // al cerrar el modal o al saltar a otro capítulo/vista sin dejar una
  // voz hablando de fondo.
  let lectorActivo = null;
  let capituloEnPantalla = null;

  function detenerLectorActivo() {
    if (lectorActivo) lectorActivo.detener();
    lectorActivo = null;
  }

  // Alterna entre el texto en español (.story-modal__body, de siempre) y
  // el panel de Lectura Inmersiva (furigana + audio + modo automático,
  // ver readerEngine.js) del capítulo actualmente en pantalla. Requiere
  // que window.MiikaeruReader ya esté cargado (readerEngine.js se carga
  // antes que este archivo en index.html) — sin eso, no rompe nada, solo
  // no hace efecto (mismo criterio defensivo del resto del módulo).
  function alternarLecturaInmersiva(refs) {
    if (!capituloEnPantalla || !window.MiikaeruReader) return;
    const mostrando = !refs.readerPanel.hidden;
    if (mostrando) {
      detenerLectorActivo();
      refs.readerPanel.hidden = true;
      refs.cuerpo.hidden = false;
      refs.readerToggle.textContent = "🈺 Entérate de la historia en japonés";
      return;
    }
    refs.cuerpo.hidden = true;
    refs.readerPanel.hidden = false;
    refs.readerToggle.textContent = "📖 Volver al texto";
    lectorActivo = window.MiikaeruReader.crearLector(refs.readerLines, capituloEnPantalla.lectura_inmersiva_jp, refs.readerAuto);
  }

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
      readerToggleRow: document.getElementById("story-modal-reader-toggle-row"),
      readerToggle: document.getElementById("story-modal-reader-toggle"),
      readerPanel: document.getElementById("story-modal-reader-panel"),
      readerLines: document.getElementById("story-modal-reader-lines"),
      readerAuto: document.getElementById("story-modal-reader-auto"),
      lightboxModal: document.getElementById("story-lightbox-modal"),
      lightboxClose: document.getElementById("story-lightbox-close"),
      lightboxImage: document.getElementById("story-lightbox-image"),
      lightboxCaption: document.getElementById("story-lightbox-caption"),
      lightboxEquipBtn: document.getElementById("story-lightbox-equip-btn"),
      lightboxEquipStatus: document.getElementById("story-lightbox-equip-status"),
    };
  }

  // ---------------- Lightbox: ver en grande + Equipar Skin ----------------
  // Click en CUALQUIER imagen de #story-modal (principal o miniatura de
  // galería), en Capítulos o Personajes por igual, abre esta capa por
  // encima del modal — pedido explícito de "al hacer clic en cualquier
  // foto se abra un modal para verla en grande". "Equipar Skin" es un
  // puente hacia window.MiikaeruSkinAPI (expuesto desde app.js, ver
  // equipGallerySkin() ahí) — este archivo vive fuera del closure de
  // DOMContentLoaded de app.js a propósito, así que no puede tocar
  // `state` directo.
  let lightboxSrcActual = null;

  function actualizarBotonEquipar(refs) {
    if (!refs.lightboxEquipBtn || !window.MiikaeruSkinAPI) return;
    const equipado = window.MiikaeruSkinAPI.isGallerySkinEquipped(lightboxSrcActual);
    refs.lightboxEquipBtn.textContent = equipado ? "✓ SKIN EQUIPADO" : "⚡ EQUIPAR SKIN";
    refs.lightboxEquipBtn.classList.toggle("story-lightbox__equip-btn--equipped", equipado);
    if (refs.lightboxEquipStatus) refs.lightboxEquipStatus.hidden = true;
  }

  function abrirLightbox(refs, src, caption) {
    if (!refs.lightboxModal || !src) return;
    lightboxSrcActual = src;
    refs.lightboxImage.src = src;
    refs.lightboxImage.alt = caption || "";
    if (refs.lightboxCaption) refs.lightboxCaption.textContent = caption || "";
    actualizarBotonEquipar(refs);
    refs.lightboxModal.hidden = false;
  }

  function cerrarLightbox(refs) {
    if (refs.lightboxModal) refs.lightboxModal.hidden = true;
    lightboxSrcActual = null;
  }

  // Los listeners de cierre (X, botón, click fuera, Escape) y del selector
  // de vista se enganchan UNA sola vez — no en cada apertura del modal,
  // para no acumular listeners duplicados cada vez que se hace click en
  // el León.
  function asegurarListeners(refs) {
    if (listenersListos || !refs.modal) return;

    const cerrar = () => {
      refs.modal.hidden = true;
      detenerLectorActivo(); // no dejar la voz de Lectura Automática hablando de fondo con el modal ya cerrado
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
    if (refs.readerToggle) {
      refs.readerToggle.addEventListener("click", () => alternarLecturaInmersiva(refs));
    }

    // Lightbox: cierre (X, click fuera, Escape — comparte la tecla con el
    // cierre del modal padre, ver más arriba) + el botón de Equipar.
    if (refs.lightboxClose) refs.lightboxClose.addEventListener("click", () => cerrarLightbox(refs));
    if (refs.lightboxModal) {
      refs.lightboxModal.addEventListener("click", (event) => {
        if (event.target === refs.lightboxModal) cerrarLightbox(refs);
      });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && refs.lightboxModal && !refs.lightboxModal.hidden) cerrarLightbox(refs);
    });
    if (refs.lightboxEquipBtn) {
      refs.lightboxEquipBtn.addEventListener("click", () => {
        if (!lightboxSrcActual || !window.MiikaeruSkinAPI) return;
        window.MiikaeruSkinAPI.equipGallerySkin(lightboxSrcActual);
        actualizarBotonEquipar(refs);
        if (refs.lightboxEquipStatus) {
          refs.lightboxEquipStatus.textContent = window.MiikaeruSkinAPI.isGallerySkinEquipped(lightboxSrcActual)
            ? "¡Listo! Tu León ya luce este retrato."
            : "Skin retirado — el León vuelve a su carrusel de siempre.";
          refs.lightboxEquipStatus.hidden = false;
        }
      });
    }

    // Click en la imagen principal (portada del capítulo o retrato del
    // personaje) también abre el lightbox — no solo las miniaturas.
    if (refs.imagen) {
      refs.imagen.style.cursor = "zoom-in";
      refs.imagen.addEventListener("click", () => abrirLightbox(refs, imagenPrincipalSrcActual, refs.imagen.alt));
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
    // La Lectura Inmersiva es propia de los capítulos (tiene texto
    // narrativo en japonés) — no aplica a una ficha de Personaje.
    if (vistaActual !== "capitulos") {
      detenerLectorActivo();
      if (refs.readerToggleRow) refs.readerToggleRow.hidden = true;
      if (refs.readerPanel) refs.readerPanel.hidden = true;
      if (refs.cuerpo) refs.cuerpo.hidden = false;
    }
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


  // Ruta RELATIVA (tal como viene de storyData.json/loreCharacters.json)
  // de lo que #story-modal-image muestra ahora mismo — separada del
  // `.src` real del <img>, que el navegador siempre resuelve a una URL
  // absoluta (http://host/assets/...). El click en la imagen principal
  // (ver asegurarListeners) usa esta variable para abrir el lightbox, así
  // el souvenir que equipGallerySkin() guarda en state.selectedSkin
  // siempre es una ruta relativa portable — igual que cuando se abre
  // desde una miniatura de galería, que ya recibe la ruta relativa
  // directo del JSON.
  let imagenPrincipalSrcActual = null;

  // Fallback de imagen: onerror oculta la imagen sola sin romper el
  // layout del modal, mismo criterio de "mejor esfuerzo" que ya usa
  // initAvatar3D() con el .glb del avatar de escritorio. Compartida entre
  // la imagen principal y los clicks de la galería, en ambas vistas.
  function fijarImagenPrincipal(refs, src, textoAlt) {
    imagenPrincipalSrcActual = src || null;
    // Guarda contra src vacío/ausente (ej. un Personaje todavía sin
    // retrato propio, como Anubis en loreCharacters.json): asignar
    // `img.src = ""` recarga el documento actual como imagen en algunos
    // navegadores en vez de simplemente no mostrar nada — mejor cortar
    // acá y ocultar el elemento, mismo criterio "mejor esfuerzo" que el
    // resto del módulo.
    if (!src) {
      refs.imagen.removeAttribute("src");
      refs.imagen.hidden = true;
      refs.imagen.alt = "";
      return;
    }
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
      // Click: ver en grande directo (pedido explícito de "cualquier
      // foto"), Y de paso deja la imagen principal en sincro con lo que
      // se acaba de ver — mismo comportamiento de siempre + el lightbox
      // nuevo encima.
      miniatura.addEventListener("click", () => {
        fijarImagenPrincipal(refs, extra.src, extra.rol || tituloAltFallback);
        abrirLightbox(refs, extra.src, extra.rol || tituloAltFallback);
      });
      refs.galeria.appendChild(miniatura);
    });
  }

  // ---------------- Vista: Capítulos (narrativa) ----------------

  function renderizarTabsCapitulos(refs, lista, idActivo, nivel) {
    refs.tabs.innerHTML = "";
    lista.forEach((capitulo) => {
      // Pedido explícito: todo el Lore (capítulos, misterios, pistas y
      // Lectura Inmersiva) queda desbloqueado desde el primer momento,
      // sin importar el nivel del Operador — nivel_requerido se sigue
      // guardando en storyData.json (se muestra como referencia en la
      // pestaña) pero ya no bloquea nada.
      const desbloqueado = true;
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

    // Ver mismo comentario en renderizarTabsCapitulos(): Lore 100% libre,
    // ya no depende del nivel del Operador.
    const desbloqueado = true;

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

    // Lectura Inmersiva de Japonés: mismo criterio de spoiler que el
    // resto del capítulo — solo se ofrece si YA está desbloqueado (es la
    // narrativa real, no la vista previa ilustrativa) y si ese capítulo
    // trae `lectura_inmersiva_jp` cargado en storyData.json. Cambiar de
    // capítulo siempre cierra el panel y corta cualquier audio en curso
    // del capítulo anterior.
    detenerLectorActivo();
    if (refs.readerPanel) refs.readerPanel.hidden = true;
    refs.cuerpo.hidden = false;
    const tieneLecturaJp = desbloqueado && Array.isArray(capitulo.lectura_inmersiva_jp) && capitulo.lectura_inmersiva_jp.length > 0;
    if (refs.readerToggleRow) refs.readerToggleRow.hidden = !tieneLecturaJp;
    if (refs.readerToggle) refs.readerToggle.textContent = "🈺 Entérate de la historia en japonés";
    capituloEnPantalla = capitulo;

    renderizarTabsCapitulos(refs, capitulos, idCapitulo, nivel);
  }

  function mostrarVistaCapitulos(refs) {
    vistaActual = "capitulos";
    marcarVistaActiva(refs);
    cargarStoryData().then((lista) => {
      if (!lista.length) return;
      // Lore 100% libre — el capítulo mostrado por defecto es
      // simplemente el primero de la lista (storyData.json ya viene en
      // orden narrativo), sin depender del nivel del Operador para nada,
      // ni siquiera para elegir con cuál abrir el modal.
      renderizarCapitulo(refs, lista[0].id, nivelRecordado);
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
