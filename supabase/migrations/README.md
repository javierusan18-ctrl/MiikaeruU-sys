# Migraciones de base de datos — versionadas en git

Carpeta nueva (Bloque 61) para dejar de correr SQL "a mano" contra el SQL
Editor de Supabase sin dejar rastro en el repo. A partir de ahora, **todo
cambio de esquema (tabla nueva, columna nueva, política RLS nueva/
modificada, publicación de realtime) se guarda acá como un archivo `.sql`
antes o al mismo tiempo que se corre en Supabase** — así queda versionado
junto con el código que depende de él, en vez de vivir solo en el
historial de "SQL Editor" de Supabase (que no es parte de este repo y no
tiene diff, ni blame, ni forma de saber qué commit de la app lo esperaba).

## Convención de nombres

```
YYYYMMDDHHMMSS_descripcion_corta.sql
```

Mismo formato que usa el CLI oficial de Supabase (`supabase migration
new <nombre>`), aunque este proyecto no usa ese CLI todavía — son archivos
de texto plano, documentación ejecutable, no algo que un script corra
solo. Un migration file nunca se edita después de haberse corrido contra
producción; un cambio posterior es un archivo NUEVO con timestamp más
alto (igual que un commit de git: no se reescribe historia).

## Qué NO es esta carpeta

- No es un ejecutor automático — nada en este repo aplica estos archivos
  contra Supabase por su cuenta. Se siguen corriendo a mano en el SQL
  Editor del dashboard, con este archivo como la fuente de verdad de qué
  correr, en qué orden, exactamente en el estado en que se corrió.
- No es retroactiva al 100%: las tablas `transactions` y `feedback`
  (y su columna `status`/políticas RLS) se crearon en bloques anteriores
  de este proyecto, ANTES de que existiera esta carpeta, y ese SQL exacto
  se entregó directo en el chat de esa sesión — no quedó guardado en
  ningún archivo del repo, así que no se puede reconstruir con certeza
  100% palabra por palabra. Si en algún momento se necesita el registro
  completo desde el día uno, el usuario puede exportarlo del propio
  historial de Supabase (Dashboard → SQL Editor → historial de queries).

## Protección real que esto da

Cuando un cambio de esquema pisa datos existentes (agregar una columna
`not null` sin default sobre una tabla con filas, cambiar un tipo, borrar
una columna) el archivo `.sql` deja ese riesgo escrito y revisable ANTES
de correrlo — no reemplaza tener cuidado al escribir el SQL, pero evita
el escenario de "until now, correr en la nube sobre la marcha, sin que
quede registro de qué se hizo ni por qué", que era el riesgo real que
esta carpeta viene a cerrar.
