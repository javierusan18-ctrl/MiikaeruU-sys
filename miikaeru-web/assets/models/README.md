# assets/models/

Carpeta para los modelos 3D del León (Baby Lion) usados por la escena
Three.js de escritorio — ver `initAvatar3D()` en `app.js`.

## Archivo esperado ahora mismo

```
assets/models/leon_nivel1.glb
```

En cuanto este archivo exista con ese nombre exacto, la escena 3D se
activa sola en la próxima carga de la página (solo en pantallas
≥768px — en mobile nunca se pide, por diseño de "Mobile Lite").
No hace falta tocar ningún código para que esto funcione: `initAvatar3D()`
ya intenta cargar `assets/models/leon_nivel1.glb` con `GLTFLoader`, y si
falla (por ejemplo, porque el archivo todavía no existe) simplemente deja
el avatar en PNG de siempre, sin errores visibles para el usuario.

## Requisitos del modelo

- Formato **.glb** (glTF binario, un solo archivo — no `.gltf` + texturas
  sueltas, para mantener un solo `fetch`).
- Malla optimizada para tiempo real (idealmente bajo ~50k triángulos para
  que cargue rápido incluso en laptops modestas).
- Escala/orientación: el modelo se agrega directo a la escena sin ningún
  ajuste de transform adicional — conviene exportarlo ya centrado en el
  origen, mirando hacia +Z, con una altura aproximada de 1-2 unidades
  (la cámara arranca en `(0, 1.4, 4.2)` mirando hacia `(0, 1, 0)`).

## Próximos niveles

Si más adelante se agregan más niveles del Baby Lion (2, 3, ...), lo más
simple es sumar archivos nuevos acá (`leon_nivel2.glb`, etc.) y extender
`AVATAR_GLB_URL` en `app.js` para que elija el archivo según
`state.level`/`rankForLevel()`, en vez de un único modelo fijo.
