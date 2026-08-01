-- Bloque 58/60 — tabla `automation_tasks`, inbox de sugerencias/bugfixes que
-- el flujo n8n-flujo-metatron (Docker local, puerto 5678) llena directo vía
-- la API REST de Supabase. La app (Panel de Administrador → pestaña
-- "Automatización") solo lee/actualiza status y payload; nada en el
-- código de la PWA inserta filas acá.
--
-- Este es el SQL que el usuario efectivamente corrió (versión simplificada
-- de una propuesta original más granular con columnas separadas para
-- description/type/priority/affected_files/source/notes) — documentado tal
-- cual, no "como debería haber sido", porque el objetivo de este archivo es
-- reflejar el estado real de la base de datos, no una versión idealizada.

create table if not exists public.automation_tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  status text not null default 'pending',
  payload jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.automation_tasks enable row level security;

-- ⚠️ Política totalmente abierta — cualquier cliente con la clave pública
-- (publishable key) de Supabase, que vive embebida en el JS servido al
-- navegador, puede leer/insertar/modificar/borrar filas de esta tabla sin
-- pasar por el candado ADMIN_EMAIL de la app. Ver el aviso completo y la
-- alternativa restringida lista para aplicar en AUTOMATION_WORKFLOW.md
-- ("Nota de seguridad, sin resolver a propósito").
create policy "Permitir todo a service_role y acceso general" on public.automation_tasks
  for all using (true) with check (true);

alter publication supabase_realtime add table public.automation_tasks;

-- Ciclo de vida de `status` (Bloque 61, ver #admin-panel-tab-automation en
-- app.js): 'pending' (default, sin tocar) → 'approved' (el admin la marcó
-- lista para pasar al flujo de desarrollo local — NO dispara ningún
-- ejecutor automático de código, ver AUTOMATION_WORKFLOW.md) o 'discarded'
-- (archivada, sigue existiendo la fila — este código nunca hace DELETE).
-- No hay CHECK constraint sobre los valores posibles de `status` a
-- propósito: n8n decide qué status inicial manda, y agregar un CHECK acá
-- podría romper una inserción de n8n que use un valor no previsto.
