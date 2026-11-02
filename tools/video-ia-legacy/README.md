# Video IA (legado local) — respaldo

Código propio que corría sobre SadTalker y Thin-Plate-Spline-Motion-Model en
`C:\dev\_modelos-ia` (borrado el 2026-09-29 al migrar a Replicate).
Los modelos NO están aquí: se descargan desde los repos originales (ver
`UPSTREAM.txt`) si alguna vez hiciera falta reconstruir el entorno local.

- `video-hablado/` — interfaz Gradio (`webapp.py`, puerto 7860), lanzadores,
  pipeline por lotes y `src-cambios.patch` (parches aplicados a SadTalker/src).
- `video-hablado/inputs/` — audios de entrada de las generaciones previas.
- `cuerpo-completo/` — `tpsmm_infer.py` + `demo-cambios.patch` para TPSMM.

Reemplazo previsto: API route en Vercel → Replicate (webhook) → Supabase Storage.
