# Mapas Mentales — Celestial OS (build embebido)

Esta carpeta **no es código fuente**: es el resultado de `npm run build` de
la app React/Vite que vive por separado en
`Desktop/MiSuiteDeApps/Mapa mental/` (fuera de este repo).

`miikaeru-web` se despliega en Vercel sin build step (`vercel.json` →
`buildCommand: null`), así que no hay forma de que Vercel compile este
proyecto automáticamente en cada deploy — por eso el build ya compilado se
commitea acá directamente, mismo espíritu de independencia que `dashboard/`
(ver comentario en `dashboard/index.html`).

## Cómo se sirve

`index.html` (raíz de `miikaeru-web`) abre esto en un `<iframe>` dentro de
un overlay a pantalla completa — ver el botón `#mindmap-open-btn` (dock
derecho, icono 🗺️) y el bloque `#mindmap-overlay` al final de ese archivo.
No está enganchado a `APP_MODULES`/`openAppModal()` de `app.js` a propósito:
esos son paneles internos del juego, y esto es un mini-frontend aparte con
su propio bundle.

## Cómo actualizar este build

Cuando cambie el código fuente de Mapa Mental:

```bash
cd "Desktop/MiSuiteDeApps/Mapa mental"
npm run build
```

Copiar el contenido de `dist/` acá (reemplazando todo esta carpeta salvo
este README), y commitear en `Miikaeru_MVP`. El `base` de
`vite.config.js` ya está configurado a `/mapa-mental/` para el build de
producción (`command === 'build'`) — si algún día esta carpeta se muda a
otra ruta dentro de `miikaeru-web`, hay que actualizar ese valor también.

Recordar bumpear `?v=` en `index.html` (style.css/app.js) y `CACHE_NAME`
en `sw.js` si se tocó algo de la app principal en el mismo commit.

Este build en sí NO necesita ese bump para que se vea fresco: `sw.js`
sirve el documento `/mapa-mental/` (la navegación del `<iframe>`) con
estrategia Network First, y ese HTML apunta a los `assets/index-<hash>.*`
que Vite generó — un build nuevo trae un hash nuevo, así que aunque el
Service Worker SÍ cachea esos archivos (misma regla `isStaticAsset()` que
cualquier `.js`/`.css` del sitio), el navegador jamás pide la URL vieja de
nuevo. El único costo es que los archivos con hash viejo quedan
huérfanos en el Cache Storage hasta el próximo bump de `CACHE_NAME` (que
sí purga cachés completos) — irrelevante en la práctica, pero si se
quiere evitar esa acumulación alcanza con bumpear `CACHE_NAME` igual.
