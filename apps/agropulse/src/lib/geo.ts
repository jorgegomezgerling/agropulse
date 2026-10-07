import type { Polygon } from "@/types";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface MapRegion extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

// GeoJSON guarda [lng, lat]; react-native-maps quiere { latitude, longitude }
export function polygonToLatLngs(polygon: Polygon): LatLng[] {
  const ring = polygon.coordinates[0] ?? [];
  return ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

export function polygonCenter(polygon: Polygon): LatLng {
  const points = polygonToLatLngs(polygon).slice(0, -1); // el último repite al primero
  const sum = points.reduce(
    (acc, p) => ({
      latitude: acc.latitude + p.latitude,
      longitude: acc.longitude + p.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );
  const count = Math.max(points.length, 1);
  return { latitude: sum.latitude / count, longitude: sum.longitude / count };
}

// "Ray casting": trazamos una línea horizontal desde el punto y contamos
// cuántos bordes del polígono cruza. Impar = adentro, par = afuera.
export function isPointInPolygon(point: LatLng, polygon: Polygon): boolean {
  const ring = polygon.coordinates[0] ?? [];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function findPlotAt<T extends { geom: Polygon }>(
  point: LatLng,
  plots: T[],
): T | null {
  return plots.find((plot) => isPointInPolygon(point, plot.geom)) ?? null;
}

// Región del mapa que encuadra todos los lotes, con un margen
export function regionForPolygons(polygons: Polygon[]): MapRegion | null {
  const points = polygons.flatMap(polygonToLatLngs);
  if (points.length === 0) return null;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.005),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.005),
  };
}
