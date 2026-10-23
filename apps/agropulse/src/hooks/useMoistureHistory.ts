import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import { useFarm } from "@/context/FarmContext";

export interface ChartPoint {
  t: number; // milisegundos (inicio del intervalo de 5 min)
  v: number; // humedad %
}

const BUCKET_MS = 5 * 60 * 1000;

export function useMoistureHistory(
  plotId: string | undefined,
  stationIds: string[],
  hours = 6,
) {
  const { subscribeReadings } = useFarm();
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const stationKey = stationIds.join(",");

  const load = useCallback(async () => {
    if (!plotId) return;
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("moisture_history", {
      p_plot_id: plotId,
      p_hours: hours,
    });
    if (rpcError) {
      setError(friendlyError(rpcError));
    } else {
      const rows = (data ?? []) as {
        bucket: string;
        moisture_pct: number | string;
      }[];
      setPoints(
        rows.map((r) => ({
          t: Date.parse(r.bucket),
          v: Number(r.moisture_pct),
        })),
      );
    }
    setLoading(false);
  }, [plotId, hours]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Cada tick de Realtime actualiza (o crea) el intervalo en curso
  useEffect(() => {
    const ids = stationKey.split(",");
    return subscribeReadings((reading) => {
      if (!ids.includes(reading.station_id)) return;
      const t =
        Math.floor(Date.parse(reading.measured_at) / BUCKET_MS) * BUCKET_MS;
      const cutoff = Date.now() - hours * 60 * 60 * 1000;
      setPoints((prev) => {
        const others = prev.filter((p) => p.t !== t && p.t >= cutoff);
        return [...others, { t, v: reading.moisture_pct }].sort(
          (a, b) => a.t - b.t,
        );
      });
    });
  }, [subscribeReadings, stationKey, hours]);

  return { points, loading, error, reload: load };
}
