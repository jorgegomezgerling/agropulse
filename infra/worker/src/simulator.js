import {
  kafka,
  supabase,
  config,
  TOPICS,
  log,
  randomBetween,
  ensureTopics,
} from "./shared.js";

const producer = kafka.producer();

// Estado de cada estación: humedad actual y el nivel "base" hacia el que tiende
const state = new Map();
let openPlots = new Set();

async function loadStations() {
  const { data, error } = await supabase
    .from("stations")
    .select("id, name, plot_id, plots(name)");
  if (error) throw error;

  for (const station of data) {
    const { data: last } = await supabase
      .from("readings")
      .select("moisture_pct")
      .eq("station_id", station.id)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const start = last ? Number(last.moisture_pct) : 30;
    state.set(station.id, {
      plotId: station.plot_id,
      plotName: station.plots?.name ?? "?",
      moisture: start,
      baseline: start,
      ticks: 0,
    });
  }
  log("sim", `${state.size} estaciones cargadas`);
}

// Simplificación didáctica: el simulador consulta qué válvulas están abiertas
// para que la humedad suba. En un campo real eso lo hace el agua sola.
async function refreshOpenValves() {
  const { data, error } = await supabase
    .from("valves")
    .select("plot_id")
    .eq("status", "open");
  if (error) {
    log("sim", "no pude leer válvulas", { error: error.message });
    return;
  }
  openPlots = new Set(data.map((valve) => valve.plot_id));
}

function nextMoisture(station) {
  if (openPlots.has(station.plotId)) {
    station.moisture += randomBetween(0.8, 1.6); // riego: sube
    station.baseline = station.moisture; // lo regado "queda"
  } else {
    station.baseline -= 0.02; // evaporación lenta
    station.moisture +=
      (station.baseline - station.moisture) * 0.1 + randomBetween(-0.4, 0.4);
  }
  station.moisture = Math.min(60, Math.max(5, station.moisture));
  station.baseline = Math.min(60, Math.max(5, station.baseline));
  return Math.round(station.moisture * 100) / 100;
}

function temperatureNow() {
  const hourArgentina = (new Date().getUTCHours() + 21) % 24; // UTC-3
  const daily = 6 * Math.sin(((hourArgentina - 9) / 24) * 2 * Math.PI);
  return Math.round((20 + daily + randomBetween(-0.5, 0.5)) * 100) / 100;
}

async function tick(stationId) {
  const station = state.get(stationId);
  station.ticks += 1;

  if (config.pausedPlots.includes(station.plotName)) {
    if (station.ticks % 5 === 0)
      log("sim", `estación pausada en ${station.plotName}, no publico`);
    return;
  }

  const ts = new Date().toISOString();
  const reading = {
    station_id: stationId,
    moisture_pct: nextMoisture(station),
    temp_c: temperatureNow(),
    ts,
  };
  await producer.send({
    topic: TOPICS.SOIL,
    messages: [{ key: stationId, value: JSON.stringify(reading) }],
  });
  log("sim", `produced ${TOPICS.SOIL}`, {
    plot: station.plotName,
    moisture_pct: reading.moisture_pct,
  });

  // Cada 4 ticks, un dato de clima (lluvia la mayoría de las veces 0)
  if (station.ticks % 4 === 0) {
    const rain =
      Math.random() < 0.15 ? Math.round(randomBetween(0.2, 3) * 10) / 10 : 0;
    station.baseline += rain * 0.5;
    await producer.send({
      topic: TOPICS.WEATHER,
      messages: [
        {
          key: stationId,
          value: JSON.stringify({ station_id: stationId, rain_mm: rain, ts }),
        },
      ],
    });
    log("sim", `produced ${TOPICS.WEATHER}`, {
      plot: station.plotName,
      rain_mm: rain,
    });
  }
}

function scheduleStation(stationId) {
  const delay = randomBetween(3000, 8000); // 1 tick cada 3–8 s (en campo real serían minutos)
  setTimeout(async () => {
    try {
      await tick(stationId);
    } catch (error) {
      log("sim", "error publicando", { error: error.message });
    }
    scheduleStation(stationId);
  }, delay);
}

async function main() {
  await ensureTopics();
  await producer.connect();
  await loadStations();
  await refreshOpenValves();
  setInterval(refreshOpenValves, 2000);
  if (config.pausedPlots.length)
    log("sim", "lotes pausados", config.pausedPlots);
  for (const stationId of state.keys()) scheduleStation(stationId);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
