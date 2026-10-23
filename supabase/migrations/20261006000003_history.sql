-- AgroPulse · Migración 3: serie de humedad agrupada cada 5 minutos (RF-10)
create or replace function public.moisture_history(p_plot_id uuid, p_hours integer default 6)
returns table (bucket timestamptz, moisture_pct numeric)
language sql stable security invoker set search_path = ''
as $$
  select
    date_bin('5 minutes', r.measured_at, timestamptz '2000-01-01') as bucket,
    round(avg(r.moisture_pct), 2) as moisture_pct
  from public.readings r
  join public.stations s on s.id = r.station_id
  where s.plot_id = p_plot_id
    and r.measured_at >= now() - make_interval(hours => p_hours)
  group by 1
  order by 1;
$$;

revoke all on function public.moisture_history(uuid, integer) from public, anon;
grant execute on function public.moisture_history(uuid, integer) to authenticated;