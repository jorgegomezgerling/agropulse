import {
  kafka,
  supabase,
  config,
  TOPICS,
  log,
  sleep,
  randomBetween,
  ensureTopics,
} from "./shared.js";

const STALE_MS = 15 * 60 * 1000;
const producer = kafka.producer();
const telemetryConsumer = kafka.consumer({ groupId: "agropulse-telemetry" });
const commandConsumer = kafka.consumer({ groupId: "agropulse-commands" });

// Catálogo en memoria: estación → lote, y umbral de cada lote
let stations = new Map();
let plots = new Map();

async function refreshCatalog() {
  const [stationsResult, plotsResult] = await Promise.all([
    supabase.from("stations").select("id, plot_id"),
    supabase.from("plots").select("id, name, threshold_min"),
  ]);
  const error = stationsResult.error ?? plotsResult.error;
  if (error) {
    log("worker", "no pude refrescar el catálogo", { error: error.message });
    return;
  }
  stations = new Map(
    stationsResult.data.map((s) => [s.id, { plotId: s.plot_id }]),
  );
  plots = new Map(
    plotsResult.data.map((p) => [
      p.id,
      { name: p.name, thresholdMin: Number(p.threshold_min) },
    ]),
  );
}

function parse(message) {
  try {
    return JSON.parse(message.value.toString());
  } catch {
    return null;
  }
}

// ---------- Alertas (RF-19 / RF-20) ----------
async function maybeCreateAlert(plotId, type, payload) {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("alerts")
    .select("id")
    .eq("plot_id", plotId)
    .eq("type", type)
    .gte("created_at", since)
    .limit(1);
  if (recent?.length) return; // ya avisamos hace poco

  const { error } = await supabase
    .from("alerts")
    .insert({ plot_id: plotId, type, payload });
  if (!error)
    log("alerts", `nueva alerta ${type}`, { plot: plots.get(plotId)?.name });
}

// ---------- Telemetría ----------
async function handleSoil(data) {
  const station = stations.get(data?.station_id);
  if (!station) {
    log("worker", "descarto soil.moisture: station_id desconocido", {
      station_id: data?.station_id,
    });
    return;
  }
  const { error } = await supabase.from("readings").insert({
    station_id: data.station_id,
    measured_at: data.ts,
    moisture_pct: data.moisture_pct,
    temp_c: data.temp_c,
    source: "sensor",
  });
  if (error) {
    log("worker", "error insertando lectura", { error: error.message });
    return;
  }
  const plot = plots.get(station.plotId);
  log("worker", "upsert reading", {
    plot: plot?.name,
    moisture_pct: data.moisture_pct,
  });

  if (plot && data.moisture_pct < plot.thresholdMin) {
    await maybeCreateAlert(station.plotId, "dry", {
      moisture_pct: data.moisture_pct,
      threshold_min: plot.thresholdMin,
    });
  }
}

async function handleWeather(data) {
  if (!stations.has(data?.station_id)) {
    log("worker", "descarto weather.tick: station_id desconocido", {
      station_id: data?.station_id,
    });
    return;
  }
  const { data: last } = await supabase
    .from("readings")
    .select("id")
    .eq("station_id", data.station_id)
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) return;
  await supabase
    .from("readings")
    .update({ rain_mm: data.rain_mm })
    .eq("id", last.id);
  log("worker", "update rain_mm", { rain_mm: data.rain_mm });
}

// ---------- Comandos ----------
async function handleCommand(data) {
  const { data: command } = await supabase
    .from("irrigation_commands")
    .select("*")
    .eq("id", data?.command_id)
    .maybeSingle();
  if (!command) {
    log("worker", "descarto irrigation.commands: comando inexistente", {
      command_id: data?.command_id,
    });
    return;
  }
  if (command.status !== "pending") {
    log("worker", `ignoro comando en estado ${command.status}`, {
      command_id: command.id,
    });
    return;
  }

  await sleep(randomBetween(config.applyMinMs, config.applyMaxMs)); // la válvula "tarda"

  // ¿Lo cancelaron mientras esperábamos? (RF-17)
  const { data: fresh } = await supabase
    .from("irrigation_commands")
    .select("status")
    .eq("id", command.id)
    .single();
  if (fresh?.status !== "pending") {
    log("worker", "comando cancelado durante la espera, lo ignoro", {
      command_id: command.id,
    });
    return;
  }

  // Camino de error académico: 10 % de fallos
  if (Math.random() < config.failureRate) {
    await supabase
      .from("irrigation_commands")
      .update({
        status: "failed",
        failure_reason: "valve_timeout",
        applied_at: new Date().toISOString(),
      })
      .eq("id", command.id)
      .eq("status", "pending");
    log("worker", "comando failed (valve_timeout simulado)", {
      command_id: command.id,
    });
    return;
  }

  const status = command.action === "close" ? "closed" : "open";
  const closesAt =
    command.action === "open_for"
      ? new Date(Date.now() + command.duration_min * 60 * 1000).toISOString()
      : null;
  const event = {
    valve_id: command.valve_id,
    status,
    command_id: command.id,
    closes_at: closesAt,
    ts: new Date().toISOString(),
  };
  await producer.send({
    topic: TOPICS.VALVE_STATUS,
    messages: [{ key: command.valve_id, value: JSON.stringify(event) }],
  });
  log("worker", `produced ${TOPICS.VALVE_STATUS}`, {
    status,
    command_id: command.id,
  });
}

async function handleValveStatus(data) {
  const { error } = await supabase
    .from("valves")
    .update({
      status: data.status,
      closes_at: data.closes_at ?? null,
      updated_at: data.ts,
    })
    .eq("id", data.valve_id);
  if (error) {
    log("worker", "error actualizando válvula", { error: error.message });
    return;
  }
  if (data.command_id) {
    await supabase
      .from("irrigation_commands")
      .update({ status: "applied", applied_at: new Date().toISOString() })
      .eq("id", data.command_id)
      .eq("status", "pending");
  }
  log("worker", "válvula actualizada", {
    valve_id: data.valve_id,
    status: data.status,
    command_id: data.command_id,
  });
}

// ---------- Puente Postgres → Redpanda ----------
async function dispatchPendingCommands() {
  const { data, error } = await supabase
    .from("irrigation_commands")
    .select("id, valve_id, action, duration_min")
    .eq("status", "pending")
    .is("dispatched_at", null)
    .order("created_at")
    .limit(20);
  if (error) {
    log("bridge", "error leyendo comandos", { error: error.message });
    return;
  }
  for (const command of data) {
    // "Reservo" el comando: solo lo publica quien logra poner dispatched_at
    const { data: claimed } = await supabase
      .from("irrigation_commands")
      .update({ dispatched_at: new Date().toISOString() })
      .eq("id", command.id)
      .is("dispatched_at", null)
      .select("id");
    if (!claimed?.length) continue;

    const event = {
      command_id: command.id,
      valve_id: command.valve_id,
      action: command.action,
      duration_min: command.duration_min,
    };
    await producer.send({
      topic: TOPICS.COMMANDS,
      messages: [{ key: command.valve_id, value: JSON.stringify(event) }],
    });
    log("bridge", `produced ${TOPICS.COMMANDS}`, {
      command_id: command.id,
      action: command.action,
    });
  }
}

// ---------- Tareas periódicas ----------
async function closeExpiredValves() {
  const { data } = await supabase
    .from("valves")
    .select("id")
    .eq("status", "open")
    .lt("closes_at", new Date().toISOString());
  for (const valve of data ?? []) {
    const event = {
      valve_id: valve.id,
      status: "closed",
      command_id: null,
      closes_at: null,
      ts: new Date().toISOString(),
    };
    await producer.send({
      topic: TOPICS.VALVE_STATUS,
      messages: [{ key: valve.id, value: JSON.stringify(event) }],
    });
    log("worker", "cierre automático por tiempo cumplido", {
      valve_id: valve.id,
    });
  }
}

async function checkStalePlots() {
  for (const [plotId] of plots) {
    const stationIds = [...stations]
      .filter(([, s]) => s.plotId === plotId)
      .map(([id]) => id);
    if (!stationIds.length) continue;
    const { data } = await supabase
      .from("readings")
      .select("measured_at")
      .in("station_id", stationIds)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const age = data ? Date.now() - Date.parse(data.measured_at) : Infinity;
    if (age > STALE_MS) {
      await maybeCreateAlert(plotId, "stale", {
        last_measured_at: data?.measured_at ?? null,
      });
    }
  }
}

async function pruneOldReadings() {
  const limit = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("readings")
    .delete({ count: "exact" })
    .lt("measured_at", limit);
  log("worker", "retención: lecturas de más de 48 h borradas", { count });
}

function every(ms, task, name) {
  const run = async () => {
    try {
      await task();
    } catch (error) {
      log("worker", `error en ${name}`, { error: error.message });
    }
  };
  setInterval(run, ms);
  run();
}

async function main() {
  await ensureTopics();
  await refreshCatalog();
  await producer.connect();
  await telemetryConsumer.connect();
  await commandConsumer.connect();
  await telemetryConsumer.subscribe({ topics: [TOPICS.SOIL, TOPICS.WEATHER] });
  await commandConsumer.subscribe({
    topics: [TOPICS.COMMANDS, TOPICS.VALVE_STATUS],
  });

  await telemetryConsumer.run({
    eachMessage: async ({ topic, message }) => {
      const data = parse(message);
      log("worker", `consumed ${topic}`);
      if (topic === TOPICS.SOIL) await handleSoil(data);
      else await handleWeather(data);
    },
  });

  await commandConsumer.run({
    partitionsConsumedConcurrently: 2, // un comando esperando no frena valve.status
    eachMessage: async ({ topic, message }) => {
      const data = parse(message);
      log("worker", `consumed ${topic}`, data);
      if (topic === TOPICS.COMMANDS) await handleCommand(data);
      else await handleValveStatus(data);
    },
  });

  every(1000, dispatchPendingCommands, "dispatch");
  every(5000, closeExpiredValves, "autocierre");
  every(10000, refreshCatalog, "catálogo");
  every(60000, checkStalePlots, "stale");
  every(60 * 60 * 1000, pruneOldReadings, "retención");
  log("worker", "listo");
}

async function shutdown() {
  log("worker", "apagando...");
  await Promise.allSettled([
    telemetryConsumer.disconnect(),
    commandConsumer.disconnect(),
    producer.disconnect(),
  ]);
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
