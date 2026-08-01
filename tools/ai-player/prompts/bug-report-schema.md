# Esquema de un hallazgo — `report_finding`

Cuando llamás a la herramienta `report_finding`, estos son los campos que
recibe y lo que significa cada uno. El script (`lib/supabase-writer.js`) los
transforma en una fila de la tabla `automation_tasks` de Supabase — la
MISMA tabla que ya lee la pestaña "🤖 Automatización (n8n)" del Panel de
Administrador, con el mismo esquema real (`title`/`status`/`payload` jsonb)
que se documentó en el Bloque 60/61 de `PROGRESS_LOG.md`.

## Campos

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `title` | string | Sí | Resumen corto, en imperativo, ≤ 70 caracteres. Va directo al campo `title` de la fila — es lo primero que un humano lee en la tarjeta del Panel de Administrador. |
| `description` | string | Sí | El detalle real: qué viste, en qué pantalla, y qué esperabas que pasara en vez de eso. Tiene que ser específico y autocontenido — un humano que nunca vio la sesión debe poder entender el problema sin más contexto. |
| `type` | string | Sí | Uno de: `"bugfix"` (algo roto), `"performance"` (algo lento), `"visual"` (algo se ve mal). No uses `"feature"` — la IA Jugador reporta problemas, no pide funciones nuevas. |
| `priority` | string | Sí | Uno de: `"low"` (cosmético, no bloquea nada), `"medium"` (afecta la experiencia pero hay forma de seguir), `"high"` (bloquea una acción central o pierde datos del usuario). |
| `steps_to_reproduce` | string | Sí | Los pasos concretos que seguiste vos mismo para llegar al problema — en qué pantalla estabas, qué elemento tocaste (`role`/`name`), en qué orden. Esto es lo que le ahorra tiempo real a la persona que lo revisa: puede reproducirlo sin adivinar.
| `console_errors` | string | No | Si `read_console_errors` mostró algo relacionado justo antes del hallazgo, pegalo acá tal cual — un stack trace real vale más que una descripción en palabras. |

## Cómo se guarda (para que entiendas qué le llega al humano que lo revisa)

```js
{
  title: "<tu title>",
  status: "pending",   // siempre arranca así — el humano decide Aprobar/Descartar
  payload: {
    description: "<tu description>\n\nPasos para reproducir:\n<tu steps_to_reproduce>",
    type: "<tu type>",
    priority: "<tu priority>",
    source: "ai-player",           // así se distingue de lo que manda n8n o un humano
    affected_files: null,          // la IA Jugador no conoce la estructura del repo, no lo completa
    notes: "<tu console_errors, si lo diste>",
  },
}
```

`source: "ai-player"` es lo que le permite a quien revisa el Panel de
Administrador saber de un vistazo que ese hallazgo lo generó esta
herramienta y no un humano ni n8n — mismo campo `payload.source` que ya
lee `renderAutomationCards()` en `app.js` para mostrar el origen en cada
tarjeta.

## Ejemplo completo

Un hallazgo real, tal como lo escribiría la IA Jugador después de explorar
el módulo de Hábitos:

```json
{
  "title": "El botón 'Marcar completado' de un hábito no actualiza la racha en pantalla",
  "description": "En el módulo de Hábitos (pestaña 'Hábitos'), toqué el botón 'Marcar completado' del primer hábito de la lista ('Meditar 10 min'). El botón cambió su ícono a un check, pero el contador de racha arriba del todo ('🔥 3') se quedó igual — no subió a 4 como esperaba, ni siquiera después de recargar la lista tocando la pestaña de nuevo.",
  "type": "bugfix",
  "priority": "medium",
  "steps_to_reproduce": "1. Abrir el módulo 'Hábitos & Rachas' desde el dock. 2. En la pestaña 'Hábitos', tocar el botón con role=button name='Marcar completado' del hábito 'Meditar 10 min'. 3. Observar el contador de racha en el HUD superior (role=text, aparece como '🔥 3' antes de tocar el botón).",
  "console_errors": null
}
```
