-- AgroPulse · Semilla
-- DATOS FICTICIOS (RNF-10): coordenadas aproximadas de la zona de Concordia (Entre Ríos),
-- no corresponden a un predio real. Las humedades son simuladas, no calibradas.
-- Requisito previo: los 4 usuarios creados en Authentication (paso 2).

-- Permite re-ejecutar la semilla: el cascade borra lotes, estaciones, lecturas, etc.
delete from public.organizations
where id in ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002');

-- Establecimientos
insert into public.organizations (id, name, region) values
  ('a0000000-0000-4000-8000-000000000001', 'Estancia Didáctica Concordia', 'Concordia, Entre Ríos'),
  ('a0000000-0000-4000-8000-000000000002', 'Chacra Los Teros (prueba RLS)', 'Concordia, Entre Ríos');

-- Roles: buscamos a cada usuario por email
insert into public.memberships (user_id, organization_id, role)
select u.id, m.org_id::uuid, m.role
from (values
  ('productor@agropulse.test', 'a0000000-0000-4000-8000-000000000001', 'producer'),
  ('operador@agropulse.test',  'a0000000-0000-4000-8000-000000000001', 'operator'),
  ('asesor@agropulse.test',    'a0000000-0000-4000-8000-000000000001', 'advisor'),
  ('productor@agropulse.test', 'a0000000-0000-4000-8000-000000000002', 'producer'),
  ('otro@agropulse.test',      'a0000000-0000-4000-8000-000000000002', 'producer')
) as m(email, org_id, role)
join auth.users u on u.email = m.email;

-- Lotes (GeoJSON: cada punto es [longitud, latitud] y el anillo se cierra repitiendo el primero)
insert into public.plots (id, organization_id, name, crop, geom) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Costa 1', 'Citrus',
   '{"type":"Polygon","coordinates":[[[-58.130,-31.330],[-58.124,-31.330],[-58.124,-31.335],[-58.130,-31.335],[-58.130,-31.330]]]}'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Costa 2', 'Citrus',
   '{"type":"Polygon","coordinates":[[[-58.123,-31.330],[-58.117,-31.330],[-58.117,-31.335],[-58.123,-31.335],[-58.123,-31.330]]]}'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Monte A', 'Soja',
   '{"type":"Polygon","coordinates":[[[-58.130,-31.336],[-58.117,-31.336],[-58.117,-31.341],[-58.130,-31.341],[-58.130,-31.336]]]}'),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 'Lote Único', 'Maíz',
   '{"type":"Polygon","coordinates":[[[-58.090,-31.300],[-58.084,-31.300],[-58.084,-31.305],[-58.090,-31.305],[-58.090,-31.300]]]}');

-- Estaciones (en el centro de cada lote)
insert into public.stations (id, plot_id, name, lat, lng) values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Estación Costa 1',    -31.3325, -58.1270),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'Estación Costa 2',    -31.3325, -58.1200),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'Estación Monte A',    -31.3385, -58.1235),
  ('c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004', 'Estación Lote Único', -31.3025, -58.0870);

-- Válvulas (todas cerradas al inicio)
insert into public.valves (id, plot_id, name) values
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Válvula Costa 1'),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'Válvula Norte'),
  ('d0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', 'Válvula Sur'),
  ('d0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000003', 'Válvula Monte A'),
  ('d0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000004', 'Válvula principal');

-- 6 horas de historia: una lectura cada 10 minutos (37 puntos por estación)
insert into public.readings (station_id, measured_at, moisture_pct, temp_c, rain_mm, source)
select
  s.station_id::uuid,
  now() - (g * interval '10 minutes'),
  round((s.base + sin(g / 4.0) * 1.5 + (random() - 0.5))::numeric, 2),
  round((22 + sin(g / 6.0) * 4 + (random() - 0.5))::numeric, 2),
  0,
  'sensor'
from (values
  ('c0000000-0000-4000-8000-000000000001', 33.0),
  ('c0000000-0000-4000-8000-000000000002', 19.0),
  ('c0000000-0000-4000-8000-000000000003', 36.0),
  ('c0000000-0000-4000-8000-000000000004', 30.0)
) as s(station_id, base)
cross join generate_series(0, 36) as g;