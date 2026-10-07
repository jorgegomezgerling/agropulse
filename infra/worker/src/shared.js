import { Kafka, logLevel } from "kafkajs";
import { createClient } from "@supabase/supabase-js";

export const TOPICS = {
  SOIL: "soil.moisture",
  WEATHER: "weather.tick",
  COMMANDS: "irrigation.commands",
  VALVE_STATUS: "valve.status",
};

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] Falta la variable ${name}. Revisá infra/.env`);
    process.exit(1);
  }
  return value;
}

export const config = {
  supabaseUrl: required("SUPABASE_URL"),
  supabaseSecretKey: required("SUPABASE_SECRET_KEY"),
  brokers: (process.env.KAFKA_BROKERS ?? "redpanda:9092").split(","),
  pausedPlots: (process.env.PAUSED_PLOTS ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean),
  applyMinMs: Number(process.env.APPLY_MIN_MS ?? 1000),
  applyMaxMs: Number(process.env.APPLY_MAX_MS ?? 4000),
  failureRate: Number(process.env.FAILURE_RATE ?? 0.1),
};

// Cliente con la SECRET key: se saltea RLS. Solo existe dentro de Docker.
export const supabase = createClient(
  config.supabaseUrl,
  config.supabaseSecretKey,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

export const kafka = new Kafka({
  clientId: "agropulse",
  brokers: config.brokers,
  logLevel: logLevel.WARN,
  retry: { retries: 10 },
});

export function log(scope, message, extra) {
  const time = new Date().toISOString().slice(11, 19);
  const detail = extra ? ` ${JSON.stringify(extra)}` : "";
  console.log(`${time} [${scope}] ${message}${detail}`);
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const randomBetween = (min, max) => min + Math.random() * (max - min);

export async function ensureTopics() {
  const admin = kafka.admin();
  await admin.connect();
  try {
    const created = await admin.createTopics({
      waitForLeaders: true,
      topics: Object.values(TOPICS).map((topic) => ({
        topic,
        numPartitions: 1,
      })),
    });
    log(
      "kafka",
      created ? "topics creados" : "topics ya existían",
      Object.values(TOPICS),
    );
  } catch (error) {
    log("kafka", "no pude crear topics (puede que ya existan)", {
      error: error.message,
    });
  } finally {
    await admin.disconnect();
  }
}
