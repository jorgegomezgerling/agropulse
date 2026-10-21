import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import { computePlotStatus } from "@/lib/plotStatus";
import { useNow } from "@/hooks/useNow";
import { useOrg } from "./OrgContext";
import type {
  Alert,
  CommandAction,
  IrrigationCommand,
  PlotOverview,
  Reading,
  Station,
  Valve,
} from "@/types";

type Row = Record<string, unknown>;

export interface IssueCommandInput {
  valveId: string;
  action: CommandAction;
  durationMin: number | null;
  clientRequestId: string;
}

interface LastTick {
  measuredAt: string;
  receivedAt: number;
}

interface FarmContextValue {
  plots: PlotOverview[];
  stations: Station[];
  valves: Valve[];
  commands: IrrigationCommand[];
  alerts: Alert[];
  loading: boolean;
  error: string | null;
  realtimeStatus: string;
  lastTick: LastTick | null;
  refresh: () => Promise<void>;
  subscribeReadings: (listener: (reading: Reading) => void) => () => void;
  updateThresholds: (plotId: string, min: number, max: number) => Promise<void>;
  issueCommand: (input: IssueCommandInput) => Promise<IrrigationCommand>;
  cancelCommand: (commandId: string) => Promise<void>;
  markAlertRead: (alertId: string) => Promise<void>;
}

const FarmContext = createContext<FarmContextValue | null>(null);

// Postgres "numeric" puede llegar como texto: lo pasamos siempre a número
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizePlot(row: Row): PlotOverview {
  const plot = row as unknown as PlotOverview;
  return {
    ...plot,
    threshold_min: toNumber(row.threshold_min) ?? 25,
    threshold_max: toNumber(row.threshold_max) ?? 45,
    moisture_pct: toNumber(row.moisture_pct),
    temp_c: toNumber(row.temp_c),
    rain_mm: toNumber(row.rain_mm),
  };
}

function normalizeReading(row: Row): Reading {
  const reading = row as unknown as Reading;
  return {
    ...reading,
    moisture_pct: toNumber(row.moisture_pct) ?? 0,
    temp_c: toNumber(row.temp_c),
    rain_mm: toNumber(row.rain_mm) ?? 0,
  };
}

// Reemplaza el elemento con el mismo id o lo agrega al principio
function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const exists = list.some((x) => x.id === item.id);
  return exists
    ? list.map((x) => (x.id === item.id ? item : x))
    : [item, ...list];
}

const byCreatedDesc = (a: { created_at: string }, b: { created_at: string }) =>
  Date.parse(b.created_at) - Date.parse(a.created_at);

export function FarmProvider({ children }: { children: ReactNode }) {
  const { activeOrg } = useOrg();
  const orgId = activeOrg?.organization_id ?? null;
  const now = useNow(10_000); // el semáforo se recalcula cada 10 s

  const [rawPlots, setRawPlots] = useState<PlotOverview[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [valves, setValves] = useState<Valve[]>([]);
  const [commands, setCommands] = useState<IrrigationCommand[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState("desconectado");
  const [lastTick, setLastTick] = useState<LastTick | null>(null);

  // Refs: los callbacks de Realtime los leen siempre actualizados
  const stationToPlot = useRef<Record<string, string>>({});
  const plotIds = useRef<Set<string>>(new Set());
  const valveIds = useRef<Set<string>>(new Set());
  const readingListeners = useRef<Set<(reading: Reading) => void>>(new Set());

  const clear = useCallback(() => {
    setRawPlots([]);
    setStations([]);
    setValves([]);
    setCommands([]);
    setAlerts([]);
    setLastTick(null);
    stationToPlot.current = {};
    plotIds.current = new Set();
    valveIds.current = new Set();
  }, []);

  const fetchCommandsAndValves = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const valvesRes = await supabase
      .from("valves")
      .select("id, plot_id, name, status, closes_at")
      .in("plot_id", ids)
      .order("name");
    if (valvesRes.error) throw valvesRes.error;
    const valveRows = (valvesRes.data ?? []) as Valve[];
    valveIds.current = new Set(valveRows.map((v) => v.id));
    setValves(valveRows);
    if (valveRows.length === 0) {
      setCommands([]);
      return;
    }
    // Últimos 100 comandos de las válvulas del establecimiento activo
    const commandsRes = await supabase
      .from("irrigation_commands")
      .select("*")
      .in(
        "valve_id",
        valveRows.map((v) => v.id),
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (commandsRes.error) throw commandsRes.error;
    setCommands((commandsRes.data ?? []) as IrrigationCommand[]);
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!orgId) {
        clear();
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setError(null);
      try {
        const plotsRes = await supabase
          .from("plot_overview")
          .select("*")
          .eq("organization_id", orgId)
          .order("name");
        if (plotsRes.error) throw plotsRes.error;
        const plotRows = ((plotsRes.data ?? []) as Row[]).map(normalizePlot);
        const ids = plotRows.map((p) => p.id);
        plotIds.current = new Set(ids);
        setRawPlots(plotRows);

        if (ids.length === 0) {
          setStations([]);
          setValves([]);
          setCommands([]);
          setAlerts([]);
          return;
        }

        const [stationsRes, alertsRes] = await Promise.all([
          supabase
            .from("stations")
            .select("id, plot_id, name")
            .in("plot_id", ids),
          supabase
            .from("alerts")
            .select("*")
            .in("plot_id", ids)
            .order("created_at", { ascending: false })
            .limit(50),
        ]);
        if (stationsRes.error) throw stationsRes.error;
        if (alertsRes.error) throw alertsRes.error;

        const stationRows = (stationsRes.data ?? []) as Station[];
        stationToPlot.current = Object.fromEntries(
          stationRows.map((s) => [s.id, s.plot_id]),
        );
        setStations(stationRows);
        setAlerts((alertsRes.data ?? []) as Alert[]);
        await fetchCommandsAndValves(ids);
      } catch (e) {
        setError(friendlyError(e));
      } finally {
        setLoading(false);
      }
    },
    [orgId, clear, fetchCommandsAndValves],
  );

  // Carga inicial y cada vez que se cambia de establecimiento
  useEffect(() => {
    clear();
    load();
  }, [load, clear]);

  // Realtime
  useEffect(() => {
    if (!orgId) return;

    const handleReading = (row: Row) => {
      const reading = normalizeReading(row);
      const plotId = stationToPlot.current[reading.station_id];
      if (!plotId) return; // es de otro establecimiento
      setRawPlots((prev) =>
        prev.map((p) =>
          p.id === plotId &&
          (!p.measured_at ||
            Date.parse(reading.measured_at) >= Date.parse(p.measured_at))
            ? {
                ...p,
                station_id: reading.station_id,
                measured_at: reading.measured_at,
                moisture_pct: reading.moisture_pct,
                temp_c: reading.temp_c,
                rain_mm: reading.rain_mm,
              }
            : p,
        ),
      );
      setLastTick({ measuredAt: reading.measured_at, receivedAt: Date.now() });
      readingListeners.current.forEach((listener) => listener(reading));
    };

    const channel = supabase
      .channel(`farm-${orgId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "readings" },
        (payload) => handleReading(payload.new as Row),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "readings" },
        (payload) => handleReading(payload.new as Row),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "valves" },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const valve = payload.new as Valve;
          if (plotIds.current.has(valve.plot_id))
            setValves((prev) => upsertById(prev, valve));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "irrigation_commands" },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const command = payload.new as IrrigationCommand;
          if (valveIds.current.has(command.valve_id)) {
            setCommands((prev) =>
              upsertById(prev, command).sort(byCreatedDesc).slice(0, 100),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const alert = payload.new as Alert;
          if (plotIds.current.has(alert.plot_id)) {
            setAlerts((prev) =>
              upsertById(prev, alert).sort(byCreatedDesc).slice(0, 50),
            );
          }
        },
      )
      .subscribe((status) => setRealtimeStatus(status));

    return () => {
      supabase.removeChannel(channel);
      setRealtimeStatus("desconectado");
    };
  }, [orgId]);

  // Plan B: mientras haya comandos pendientes, polling cada 3 s (RF-15)
  const hasPending = commands.some((c) => c.status === "pending");
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => {
      fetchCommandsAndValves([...plotIds.current]).catch(() => undefined);
    }, 3000);
    return () => clearInterval(id);
  }, [hasPending, fetchCommandsAndValves]);

  // Al volver a primer plano, recarga en silencio
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") load(true);
    });
    return () => subscription.remove();
  }, [load]);

  const subscribeReadings = useCallback(
    (listener: (reading: Reading) => void) => {
      readingListeners.current.add(listener);
      return () => {
        readingListeners.current.delete(listener);
      };
    },
    [],
  );

  const updateThresholds = useCallback(
    async (plotId: string, min: number, max: number) => {
      const { data, error: updateError } = await supabase
        .from("plots")
        .update({ threshold_min: min, threshold_max: max })
        .eq("id", plotId)
        .select("id");
      if (updateError) throw updateError;
      // Si RLS no te deja, Postgres no da error: actualiza 0 filas
      if (!data || data.length === 0) throw new Error("FORBIDDEN");
      setRawPlots((prev) =>
        prev.map((p) =>
          p.id === plotId
            ? { ...p, threshold_min: min, threshold_max: max }
            : p,
        ),
      );
    },
    [],
  );

  const issueCommand = useCallback(async (input: IssueCommandInput) => {
    const { data, error: rpcError } = await supabase.rpc(
      "issue_irrigation_command",
      {
        p_valve_id: input.valveId,
        p_action: input.action,
        p_duration_min: input.durationMin,
        p_client_request_id: input.clientRequestId,
      },
    );
    if (rpcError) throw rpcError;
    const command = data as IrrigationCommand;
    setCommands((prev) => upsertById(prev, command).sort(byCreatedDesc));
    return command;
  }, []);

  const cancelCommand = useCallback(async (commandId: string) => {
    const { data, error: rpcError } = await supabase.rpc(
      "cancel_irrigation_command",
      {
        p_command_id: commandId,
      },
    );
    if (rpcError) throw rpcError;
    const command = data as IrrigationCommand;
    setCommands((prev) => upsertById(prev, command).sort(byCreatedDesc));
  }, []);

  const markAlertRead = useCallback(async (alertId: string) => {
    const { data, error: updateError } = await supabase
      .from("alerts")
      .update({ read_at: new Date().toISOString() })
      .eq("id", alertId)
      .select("*");
    if (updateError) throw updateError;
    if (!data || data.length === 0) throw new Error("FORBIDDEN");
    setAlerts((prev) => upsertById(prev, data[0] as Alert));
  }, []);

  // Mismo cálculo que la vista SQL, pero con la hora actual del teléfono
  const plots = useMemo(
    () => rawPlots.map((p) => ({ ...p, status: computePlotStatus(p, now) })),
    [rawPlots, now],
  );

  const refresh = useCallback(() => load(true), [load]);

  const value = useMemo<FarmContextValue>(
    () => ({
      plots,
      stations,
      valves,
      commands,
      alerts,
      loading,
      error,
      realtimeStatus,
      lastTick,
      refresh,
      subscribeReadings,
      updateThresholds,
      issueCommand,
      cancelCommand,
      markAlertRead,
    }),
    [
      plots,
      stations,
      valves,
      commands,
      alerts,
      loading,
      error,
      realtimeStatus,
      lastTick,
      refresh,
      subscribeReadings,
      updateThresholds,
      issueCommand,
      cancelCommand,
      markAlertRead,
    ],
  );

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm(): FarmContextValue {
  const context = useContext(FarmContext);
  if (!context) throw new Error("useFarm debe usarse dentro de <FarmProvider>");
  return context;
}
