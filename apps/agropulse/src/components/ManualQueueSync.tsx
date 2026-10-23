import { useEffect } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useAuth } from "@/context/AuthContext";
import { flushQueue } from "@/lib/manualQueue";

// No dibuja nada: cuando vuelve la red (o la app vuelve a primer plano), sube la cola
export function ManualQueueSync() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) return;
    const tryFlush = () => {
      flushQueue(userId).catch(() => undefined);
    };
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) tryFlush();
    });
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") tryFlush();
    });
    tryFlush();
    return () => {
      unsubscribeNet();
      appStateSub.remove();
    };
  }, [userId]);

  return null;
}
