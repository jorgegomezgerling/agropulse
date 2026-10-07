export type Role = "producer" | "operator" | "advisor";
export type PlotStatus = "stale" | "dry" | "optimal" | "wet";
export type ValveStatus = "open" | "closed";
export type CommandAction = "open" | "close" | "open_for";
export type CommandStatus = "pending" | "applied" | "failed" | "cancelled";
export type AlertType = "dry" | "stale";

// GeoJSON: cada posición es [longitud, latitud]
export type Position = [number, number];
export interface Polygon {
  type: "Polygon";
  coordinates: Position[][];
}

export interface Organization {
  id: string;
  name: string;
  region: string | null;
}

export interface Membership {
  organization_id: string;
  role: Role;
  organizations: Organization;
}

// Una fila de la vista plot_overview: el lote + su última lectura
export interface PlotOverview {
  id: string;
  organization_id: string;
  name: string;
  crop: string | null;
  geom: Polygon;
  threshold_min: number;
  threshold_max: number;
  station_id: string | null;
  measured_at: string | null;
  moisture_pct: number | null;
  temp_c: number | null;
  rain_mm: number | null;
  status: PlotStatus;
}

export interface Station {
  id: string;
  plot_id: string;
  name: string;
}

export interface Reading {
  id: string;
  station_id: string;
  measured_at: string;
  moisture_pct: number;
  temp_c: number | null;
  rain_mm: number;
  source: "sensor" | "manual";
}

export interface Valve {
  id: string;
  plot_id: string;
  name: string;
  status: ValveStatus;
  closes_at: string | null;
}

export interface IrrigationCommand {
  id: string;
  valve_id: string;
  requested_by: string | null;
  requested_by_email: string | null;
  action: CommandAction;
  duration_min: number | null;
  status: CommandStatus;
  failure_reason: string | null;
  client_request_id: string;
  created_at: string;
  applied_at: string | null;
}

export interface Alert {
  id: string;
  plot_id: string;
  type: AlertType;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}
