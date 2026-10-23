import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { isNetworkError } from "./errors";

const KEY = "agropulse.manualQueue";

export interface ManualReadingDraft {
  client_id: string;
  station_id: string;
  moisture_pct: number;
  note: string | null;
  lat: number | null;
  lng: number | null;
  measured_at: string;
}

const listeners = new Set<(pending: number) => void>();

export function onQueueChange(listener: (pending: number) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function getQueue(): Promise<ManualReadingDraft[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as ManualReadingDraft[]) : [];
}

async function saveQueue(items: ManualReadingDraft[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
  listeners.forEach((listener) => listener(items.length));
}

export async function enqueue(item: ManualReadingDraft) {
  const queue = await getQueue();
  await saveQueue([...queue, item]);
}

let flushing = false;

// Sube lo pendiente. Lo que falla por red queda; lo que el servidor rechaza se descarta.
export async function flushQueue(
  userId: string,
): Promise<{ sent: number; rejected: number }> {
  if (flushing) return { sent: 0, rejected: 0 };
  flushing = true;
  try {
    const queue = await getQueue();
    const remaining: ManualReadingDraft[] = [];
    let sent = 0;
    let rejected = 0;
    for (const item of queue) {
      const { error } = await supabase
        .from("readings")
        .upsert(
          { ...item, source: "manual", created_by: userId },
          { onConflict: "client_id", ignoreDuplicates: true },
        );
      if (!error) sent += 1;
      else if (isNetworkError(error)) remaining.push(item);
      else rejected += 1;
    }
    await saveQueue(remaining);
    return { sent, rejected };
  } finally {
    flushing = false;
  }
}
