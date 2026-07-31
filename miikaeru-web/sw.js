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
const CACHE_NAME = "miikaeru-cache-v20260801-20";

const STATIC_ASSETS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "manifest.json",
  "assets/avatar_idle.png",
  "assets/avatar_meditating.png",
  "assets/avatar_boss_mode.png",
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
    event.respondWith(
      fetch(event.request)
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
