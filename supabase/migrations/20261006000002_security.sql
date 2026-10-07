-- AgroPulse · Migración 2: RLS, vista del semáforo, RPC de comandos y Realtime

-- ============================================================
-- 1. Funciones auxiliares (security definer: leen memberships sin RLS)
-- ============================================================
create or replace function public.is_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_role(p_org uuid, p_roles text[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

create or replace function public.plot_org(p_plot uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select organization_id from public.plots where id = p_plot;
$$;

create or replace function public.station_org(p_station uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.organization_id
  from public.stations s
  join public.plots p on p.id = s.plot_id
  where s.id = p_station;
$$;

create or replace function public.valve_org(p_valve uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.organization_id
  from public.valves v
  join public.plots p on p.id = v.plot_id
  where v.id = p_valve;
$$;

-- ============================================================
-- 2. Activar RLS en todas las tablas
-- ============================================================
alter table public.organizations       enable row level security;
alter table public.memberships         enable row level security;
alter table public.plots               enable row level security;
alter table public.stations            enable row level security;
alter table public.readings            enable row level security;
alter table public.valves              enable row level security;
alter table public.irrigation_commands enable row level security;
alter table public.alerts              enable row level security;

-- ============================================================
-- 3. Policies (solo para usuarios logueados; anon no ve nada)
-- ============================================================
create policy "organizations: miembros leen"
  on public.organizations for select to authenticated
  using (public.is_member(id));

create policy "memberships: cada uno ve las suyas"
  on public.memberships for select to authenticated
  using (user_id = (select auth.uid()));

create policy "plots: miembros leen"
  on public.plots for select to authenticated
  using (public.is_member(organization_id));

create policy "plots: productor edita umbrales"
  on public.plots for update to authenticated
  using (public.has_role(organization_id, array['producer']))
  with check (public.has_role(organization_id, array['producer']));

-- En plots solo se pueden actualizar las dos columnas de umbral
revoke update on public.plots from authenticated;
grant update (threshold_min, threshold_max) on public.plots to authenticated;

create policy "stations: miembros leen"
  on public.stations for select to authenticated
  using (public.is_member(public.plot_org(plot_id)));

create policy "readings: miembros leen"
  on public.readings for select to authenticated
  using (public.is_member(public.station_org(station_id)));

-- Las lecturas de sensor las escribe el worker (secret key, se saltea RLS).
-- Desde la app solo se permiten lecturas manuales propias.
create policy "readings: productor y operador cargan lecturas manuales"
  on public.readings for insert to authenticated
  with check (
    source = 'manual'
    and created_by = (select auth.uid())
    and public.has_role(public.station_org(station_id), array['producer', 'operator'])
  );

create policy "valves: miembros leen"
  on public.valves for select to authenticated
  using (public.is_member(public.plot_org(plot_id)));

create policy "irrigation_commands: miembros leen"
  on public.irrigation_commands for select to authenticated
  using (public.is_member(public.valve_org(valve_id)));
-- Sin policy de insert/update: los comandos solo entran por los RPC de abajo.

create policy "alerts: miembros leen"
  on public.alerts for select to authenticated
  using (public.is_member(public.plot_org(plot_id)));

create policy "alerts: productor y operador marcan leídas"
  on public.alerts for update to authenticated
  using (public.has_role(public.plot_org(plot_id), array['producer', 'operator']))
  with check (public.has_role(public.plot_org(plot_id), array['producer', 'operator']));

revoke update on public.alerts from authenticated;
grant update (read_at) on public.alerts to authenticated;

-- ============================================================
-- 4. Vista del semáforo (§8). Respeta el RLS de quien consulta.
-- ============================================================
create or replace view public.plot_overview
with (security_invoker = true) as
select
  p.id,
  p.organization_id,
  p.name,
  p.crop,
  p.geom,
  p.threshold_min,
  p.threshold_max,
  lr.station_id,
  lr.measured_at,
  lr.moisture_pct,
  lr.temp_c,
  lr.rain_mm,
  case
    when lr.measured_at is null
      or now() - lr.measured_at > interval '15 minutes' then 'stale'
    when lr.moisture_pct < p.threshold_min then 'dry'
    when lr.moisture_pct > p.threshold_max then 'wet'
    else 'optimal'
  end as status
from public.plots p
left join lateral (
  select r.station_id, r.measured_at, r.moisture_pct, r.temp_c, r.rain_mm
  from public.readings r
  join public.stations s on s.id = r.station_id
  where s.plot_id = p.id
  order by r.measured_at desc
  limit 1
) lr on true;

-- ============================================================
-- 5. RPC: emitir comando (valida rol, RF-16 e idempotencia)
-- ============================================================
create or replace function public.issue_irrigation_command(
  p_valve_id uuid,
  p_action text,
  p_duration_min integer,
  p_client_request_id uuid
)
returns public.irrigation_commands
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid;
  v_cmd public.irrigation_commands;
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  v_org := public.valve_org(p_valve_id);
  if v_org is null or not public.is_member(v_org) then
    raise exception 'VALVE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.has_role(v_org, array['producer', 'operator']) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- Idempotencia: si este client_request_id ya entró, devolvemos ese comando
  select * into v_cmd
  from public.irrigation_commands
  where client_request_id = p_client_request_id;
  if found then
    return v_cmd;
  end if;

  if p_action not in ('open', 'close', 'open_for') then
    raise exception 'INVALID_ACTION' using errcode = '22023';
  end if;

  if p_action = 'open_for'
     and (p_duration_min is null or p_duration_min not between 1 and 120) then
    raise exception 'INVALID_DURATION' using errcode = '22023';
  end if;

  -- RF-16: ya hay un comando pendiente en esta válvula
  if exists (
    select 1 from public.irrigation_commands
    where valve_id = p_valve_id and status = 'pending'
  ) then
    raise exception 'VALVE_BUSY' using errcode = 'P0001';
  end if;

  insert into public.irrigation_commands
    (valve_id, requested_by, requested_by_email, action, duration_min, client_request_id)
  values (
    p_valve_id,
    (select auth.uid()),
    (select auth.jwt() ->> 'email'),
    p_action,
    case when p_action = 'open_for' then p_duration_min end,
    p_client_request_id
  )
  returning * into v_cmd;

  return v_cmd;
exception
  -- Dos pedidos simultáneos: el índice único decide quién gana
  when unique_violation then
    select * into v_cmd
    from public.irrigation_commands
    where client_request_id = p_client_request_id;
    if found then
      return v_cmd;
    end if;
    raise exception 'VALVE_BUSY' using errcode = 'P0001';
end;
$$;

-- ============================================================
-- 6. RPC: cancelar comando pendiente (RF-17)
-- ============================================================
create or replace function public.cancel_irrigation_command(p_command_id uuid)
returns public.irrigation_commands
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid;
  v_cmd public.irrigation_commands;
begin
  select public.valve_org(c.valve_id) into v_org
  from public.irrigation_commands c
  where c.id = p_command_id;

  if v_org is null or not public.is_member(v_org) then
    raise exception 'COMMAND_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.has_role(v_org, array['producer', 'operator']) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.irrigation_commands
  set status = 'cancelled'
  where id = p_command_id and status = 'pending'
  returning * into v_cmd;

  if not found then
    raise exception 'NOT_PENDING' using errcode = 'P0001';
  end if;

  return v_cmd;
end;
$$;

revoke all on function public.issue_irrigation_command(uuid, text, integer, uuid) from public, anon;
grant execute on function public.issue_irrigation_command(uuid, text, integer, uuid) to authenticated;
revoke all on function public.cancel_irrigation_command(uuid) from public, anon;
grant execute on function public.cancel_irrigation_command(uuid) to authenticated;

-- ============================================================
-- 7. Realtime: publicar los cambios de estas tablas
-- ============================================================
alter publication supabase_realtime
  add table public.readings, public.valves, public.irrigation_commands, public.alerts;