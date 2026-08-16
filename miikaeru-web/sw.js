// Service Worker de Miikaeru_SYS — estrategia "Cache First" para los
// assets estáticos propios del sitio (CSS, JS, imágenes, manifest): la
// primera vez se guardan en caché, y desde la segunda visita se sirven
// directo desde ahí (carga instantánea, funciona sin internet), sin
// siquiera esperar a la red. El documento HTML (navegación) es la ÚNICA
// excepción — usa "Network First" (ver el listener "fetch" más abajo):
// es el único archivo que NUNCA cambia de nombre entre deploys (a
// diferencia de style.css?v=X/app.js?v=X, que sí cambian de URL en cada
// release gracias al cache-busting) — si se sirviera cacheado primero,
// un deploy nuevo podía quedar invisible indefinidamente para cualquier
// celular/pestaña que ya lo tuviera guardado, porque nunca volvería a
// pedirlo a la red por su cuenta hasta que el propio Service Worker se
// actualizara (y ni siquiera ahí, sin recargar — ver el listener de
// "controllerchange" en index.html).
//
// Todo lo demás (llamadas a la API REST de Supabase, los CDN de Hanzi
// Writer/Supabase-js, cualquier request cross-origin) pasa de largo sin
// tocar el caché — cachear esas respuestas rompería datos en tiempo real
// o fijaría para siempre una versión de una librería externa.
//
// CACHE_NAME lleva el mismo número de versión que los `?v=` de
// index.html (ver ese archivo) — subirlo a mano en cada deploy real
// hace que `activate` borre el caché viejo y todo se vuelva a guardar
// fresco, evitando que un celular se quede pegado en una versión vieja.
const CACHE_NAME = "miikaeru-cache-v20260815-11";

const STATIC_ASSETS = [
  "./",
  "index.html",
  // Landing pública de instalación (ver download.html) — autocontenida,
  // sin app.js/style.css, pensada como posible primera página que ve un
  // visitante nuevo antes de entrar al dashboard. Se precachea aparte
  // (no depende del cacheo automático de `index.html` en el listener
  // "fetch" más abajo) para que también funcione offline en una
  // instalación fresca que todavía no la visitó nunca.
  "download.html",
  "style.css",
  "app.js",
  // storyEngine.js: módulo aparte del Modal de Lore (ver comentario más
  // abajo) — mismo "mejor esfuerzo" que el resto de este archivo.
  "storyEngine.js",
  // readerEngine.js: Lectura Inmersiva de Japonés (furigana + audio +
  // modo automático), compartido por el Japonés AI Coach y el Modal de
  // Lore — ninguno de los dos lo trae embebido, así que necesita su
  // propia entrada acá igual que storyEngine.js.
  "readerEngine.js",
  // floatingWindow.js: sistema de ventanas arrastrables/redimensionables/
  // minimizables/maximizables (tarjeta del León + panel de Chat en
  // desktop) — mismo criterio que los dos módulos de arriba.
  "floatingWindow.js",
  "manifest.json",
  // Iconos PWA (ver manifest.json + <link rel="apple-touch-icon"/icon">
  // en index.html) — sin estos, el prompt de instalación y el ícono de
  // pantalla de inicio caerían al ícono genérico del navegador si el
  // usuario instala la app estando offline la primera vez.
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-192.png",
  "assets/icons/icon-maskable-512.png",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/favicon-32.png",
  "assets/icons/favicon-48.png",
  "assets/bg_main.png",
  "assets/bg_login.png",
  "assets/bg_state_idle.png",
  "assets/bg_state_meditation.png",
  "assets/props_floating_rocks.png",
  // Avatar 3D de escritorio (ver initAvatar3D() en app.js) — el archivo
  // TODAVÍA NO EXISTE en el repo (solo el placeholder de
  // assets/models/README.md). A propósito NO se usa cache.addAll() más
  // abajo para esta lista completa: addAll() es atómico — si UN solo
  // recurso de la lista da 404, NINGUNO se guarda, ni siquiera el resto
  // de los PNG/CSS/JS que sí existen. Por eso el precache de abajo cachea
  // cada archivo por separado y sigue de largo con los que fallan; en
  // cuanto este .glb se agregue de verdad, la próxima instalación del SW
  // lo cachea solo, sin tocar código.
  "assets/models/leon_nivel1.glb",
  // "Mikaeru skin" (assets/skins/) — arte real, reorganizado por el
  // usuario en subcarpetas por personaje (assets/skins/Miikaeruu/,
  // Mascotas/, etc. — ver el resto de imágenes en cada carpeta, NO
  // precacheadas acá a propósito: la Galería del Núcleo del Modal de
  // Lore las pide bajo demanda y quedan cacheadas solas la primera vez
  // que se ven, vía la regla genérica png/jpg del listener "fetch" más
  // abajo). Acá solo se precachean los retratos de Miikaeru que hacen
  // falta apenas arranca la app: el estado "idle" del avatar del HUD
  // (ver AVATAR_STATE_ASSETS en app.js) y el set completo de
  // MIIKAERU_SKINS (#skins-modal) para que el selector de skins funcione
  // sin red incluso offline.
  "assets/skins/Miikaeruu/mikaeru_idle_chakras.png",
  "assets/skins/Miikaeruu/mikaeru_sacrificio_despertar.png",
  "assets/skins/Miikaeruu/mikaeru_familia_portada.png",
  "assets/skins/Miikaeruu/mikaeru_skin_cazador_neon.png",
  "assets/skins/Miikaeruu/mikaeru_skin_guardian_templo.png",
  "assets/skins/Miikaeruu/mikaeru_skin_soberano_estelar.png",
  "assets/skins/Miikaeruu/mikaeru_skin_comandante_ejercito.png",
  "assets/skins/Miikaeruu/mikaeru_skin_heraldo_rugiente.png",
  "assets/skins/Miikaeruu/mikaeru_skin_deidad_meditante.png",
  "assets/skins/Miikaeruu/Gemini_Generated_Image_7ag41v7ag41v7ag4.png",
  "assets/skins/Mascotas/mikaeru_cachorro_cosmico_wakai.png",
  "assets/skins/Mascotas/mikaeru_skin_cachorro_dormido.png",
  "assets/skins/Mascotas/mikaeru_skin_cachorro_galactico.png",
  // storyData.json/loreCharacters.json alimentan el Modal de Lore
  // completo (capítulos + enciclopedia de Personajes, ver
  // storyEngine.js) — el resto de las imágenes que referencian (Demiure,
  // Metrakaela, Valeria, Metatron, Ateneea, Azathoth, Fotos Grupales...)
  // se cachean solas al verse por primera vez, mismo criterio de arriba.
  "data/storyData.json",
  "data/loreCharacters.json",
  "assets/lion-base.png",
  "assets/mandala.png",
  "assets/lion-glow.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        STATIC_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            // "Mejor esfuerzo" por archivo — un asset opcional que falta
            // (como el .glb de hoy) no debe tirar abajo el precache del
            // resto de assets que sí existen.
            console.warn(`SW install: no se pudo precachear "${asset}" (se sigue con el resto):`, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function isNavigationRequest(request, url) {
  // request.mode === "navigate" cubre la carga normal de una URL; los dos
  // chequeos de pathname son respaldo para casos donde algún navegador/PWA
  // shell pida el documento con otro `mode` (ha pasado en algunos wrappers
  // de Android para apps "Agregadas a la pantalla de inicio").
  return request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith("/index.html");
}

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  // "glb" incluido para el modelo 3D del avatar de escritorio (ver
  // initAvatar3D() en app.js) — sin esto, aunque el archivo exista, cada
  // fetch de assets/models/leon_nivel1.glb pasaría de largo del caché
  // (ver el `return` de abajo en el listener "fetch") y se pediría de
  // nuevo a la red en cada carga, incluso estando offline.
  return /\.(?:css|js|png|jpg|jpeg|svg|webp|json|glb)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return; // deja pasar todo lo demás sin tocarlo

  // Network First para el documento HTML: intenta la red primero para que
  // cualquier visita con internet vea el deploy más reciente (y por lo
  // tanto las URLs `?v=` nuevas de style.css/app.js) sin esperar a que el
  // Service Worker se actualice solo. El caché queda como respaldo SOLO
  // para cuando no hay red — ahí sí se sirve lo último que se guardó.
  if (isNavigationRequest(event.request, url)) {
    // `cache: "reload"` fuerza a este fetch a ignorar por completo el
    // caché HTTP del navegador (no solo el Cache Storage de este SW) y
    // pedirle el documento a la red de verdad — sin esto, algunos
    // navegadores podían servir una copia de index.html guardada en su
    // caché HTTP normal aunque el SW quisiera "Network First", dejando
    // a un usuario pegado en una versión vieja pese a tener internet.
    // Ver también vercel.json: "/" e "/index.html" ahora mandan
    // Cache-Control: no-cache/no-store desde el origen, doble refuerzo
    // del mismo objetivo (que el HTML SIEMPRE se revalide con la red).
    event.respondWith(
      fetch(event.request, { cache: "reload" })
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  if (!isStaticAsset(url)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached; // Cache First: ni siquiera pide la red si ya está guardado

      return fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // sin red y sin caché: no hay nada más que ofrecer
    })
  );
});
