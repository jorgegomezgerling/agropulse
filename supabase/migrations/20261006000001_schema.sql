-- AgroPulse · Migración 1: tablas
-- Nombres en inglés en SQL; la UI muestra etiquetas en español.

-- Establecimientos
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  region      text,
  created_at  timestamptz not null default now()
);

-- Quién pertenece a qué establecimiento y con qué rol
create table public.memberships (
  user_id          uuid not null references auth.users (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  role             text not null check (role in ('producer', 'operator', 'advisor')),
  created_at       timestamptz not null default now(),
  primary key (user_id, organization_id)
);

-- Lotes. geom guarda un GeoJSON Polygon: {"type":"Polygon","coordinates":[[[lng,lat], ...]]}
create table public.plots (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null,
  crop             text,
  geom             jsonb not null,
  threshold_min    numeric(5,2) not null default 25,
  threshold_max    numeric(5,2) not null default 45,
  created_at       timestamptz not null default now(),
  constraint plots_geom_is_polygon check (geom ->> 'type' = 'Polygon'),
  constraint plots_thresholds_valid check (
    threshold_min >= 0 and threshold_max <= 100 and threshold_min < threshold_max
  )
);
create index plots_organization_idx on public.plots (organization_id);

-- Estaciones de medición
create table public.stations (
  id       uuid primary key default gen_random_uuid(),
  plot_id  uuid not null references public.plots (id) on delete cascade,
  name     text not null,
  lat      double precision not null,
  lng      double precision not null
);
create index stations_plot_idx on public.stations (plot_id);

-- Lecturas (sensor o manual)
create table public.readings (
  id            uuid primary key default gen_random_uuid(),
  station_id    uuid not null references public.stations (id) on delete cascade,
  measured_at   timestamptz not null,
  moisture_pct  numeric(5,2) not null check (moisture_pct between 0 and 100),
  temp_c        numeric(5,2),
  rain_mm       numeric(6,2) not null default 0,
  source        text not null default 'sensor' check (source in ('sensor', 'manual')),
  client_id     uuid unique,              -- idempotencia de lecturas manuales (RF-21)
  created_by    uuid references auth.users (id) on delete set null,
  note          text,
  lat           double precision,
  lng           double precision,
  created_at    timestamptz not null default now()
);
-- Índice que pide la consigna: "la última lectura de una estación" es instantánea
create index readings_station_measured_idx on public.readings (station_id, measured_at desc);

-- Válvulas
create table public.valves (
  id          uuid primary key default gen_random_uuid(),
  plot_id     uuid not null references public.plots (id) on delete cascade,
  name        text not null,
  status      text not null default 'closed' check (status in ('open', 'closed')),
  closes_at   timestamptz,                -- si se abrió "por N minutos"
  updated_at  timestamptz not null default now()
);
create index valves_plot_idx on public.valves (plot_id);

-- Comandos de riego
create table public.irrigation_commands (
  id                  uuid primary key default gen_random_uuid(),
  valve_id            uuid not null references public.valves (id) on delete cascade,
  requested_by        uuid references auth.users (id) on delete set null,
  requested_by_email  text,
  action              text not null check (action in ('open', 'close', 'open_for')),
  duration_min        integer check (duration_min between 1 and 120),
  status              text not null default 'pending'
                      check (status in ('pending', 'applied', 'failed', 'cancelled')),
  failure_reason      text,
  client_request_id   uuid not null unique,  -- idempotencia
  created_at          timestamptz not null default now(),
  dispatched_at       timestamptz,            -- cuándo el worker lo publicó en Redpanda
  applied_at          timestamptz,
  constraint duration_only_for_open_for check ((action = 'open_for') = (duration_min is not null))
);
-- RF-16: como mucho UN comando pending por válvula
create unique index irrigation_commands_one_pending_per_valve
  on public.irrigation_commands (valve_id) where status = 'pending';
create index irrigation_commands_valve_created_idx
  on public.irrigation_commands (valve_id, created_at desc);

-- Alertas
create table public.alerts (
  id          uuid primary key default gen_random_uuid(),
  plot_id     uuid not null references public.plots (id) on delete cascade,
  type        text not null check (type in ('dry', 'stale')),
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index alerts_plot_created_idx on public.alerts (plot_id, created_at desc);