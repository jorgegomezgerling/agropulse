import type { PlotStatus } from "@/types";

// Misma fórmula que la vista public.plot_overview (§8 de la consigna)
export const STALE_AFTER_MS = 15 * 60 * 1000;
export const DEFAULT_THRESHOLD_MIN = 25;
export const DEFAULT_THRESHOLD_MAX = 45;

export interface StatusInput {
  moisture_pct: number | null;
  measured_at: string | null;
  threshold_min: number | null;
  threshold_max: number | null;
}

export function computePlotStatus(
  input: StatusInput,
  now: number = Date.now(),
): PlotStatus {
  const min = input.threshold_min ?? DEFAULT_THRESHOLD_MIN;
  const max = input.threshold_max ?? DEFAULT_THRESHOLD_MAX;

  if (input.measured_at === null || input.moisture_pct === null) return "stale";
  const age = now - Date.parse(input.measured_at);
  if (Number.isNaN(age) || age > STALE_AFTER_MS) return "stale";
  if (input.moisture_pct < min) return "dry";
  if (input.moisture_pct > max) return "wet";
  return "optimal";
}
