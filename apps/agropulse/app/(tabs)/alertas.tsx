import { useState } from "react";
import {
  Alert as NativeAlert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import { useOrg } from "@/context/OrgContext";
import { useNow } from "@/hooks/useNow";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/ScreenState";
import { FarmGate } from "@/components/FarmGate";
import { NetworkBanner } from "@/components/NetworkBanner";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { friendlyError } from "@/lib/errors";
import { formatDateTime, timeAgo } from "@/lib/time";
import type { Alert, AlertType } from "@/types";
import {
  colors,
  fontSize,
  fontWeight,
  layout,
  radius,
  spacing,
  statusMeta,
  type IconName,
} from "@/theme";

const alertMeta: Record<
  AlertType,
  { title: string; icon: IconName; color: string }
> = {
  dry: {
    title: "Lote seco",
    icon: statusMeta.dry.icon,
    color: statusMeta.dry.color,
  },
  stale: {
    title: "Estación sin datos",
    icon: statusMeta.stale.icon,
    color: statusMeta.stale.color,
  },
};

function describe(alert: Alert): string {
  if (alert.type === "dry") {
    const moisture = Number(alert.payload.moisture_pct);
    const threshold = Number(alert.payload.threshold_min);
    return `Humedad ${moisture.toFixed(1)} % bajo el mínimo de ${threshold} %. Considerar riego.`;
  }
  return 'Sin lecturas hace más de 15 minutos. No es "seco": no hay datos confiables.';
}

export default function AlertsScreen() {
  const { alerts, plots, markAlertRead } = useFarm();
  const { canCommand } = useOrg();
  const now = useNow(30_000);
  const [busyId, setBusyId] = useState<string | null>(null);
  const plotName = new Map(plots.map((p) => [p.id, p.name]));

  const onMarkRead = async (alertId: string) => {
    setBusyId(alertId);
    try {
      await markAlertRead(alertId);
    } catch (error) {
      NativeAlert.alert("No se pudo marcar", friendlyError(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.screen}>
      <OrgSwitcher />
      <NetworkBanner />
      <FarmGate>
        <FlatList
          data={alerts}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-off-outline"
              title="Sin alertas"
              message="Todo en orden por ahora."
            />
          }
          renderItem={({ item }) => {
            const meta = alertMeta[item.type];
            const unread = item.read_at === null;
            return (
              <Pressable
                onPress={() => router.push(`/lote/${item.plot_id}`)}
                style={[
                  styles.card,
                  { borderLeftColor: meta.color },
                  !unread && styles.read,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${meta.title} en ${plotName.get(item.plot_id) ?? "lote"}${unread ? ", sin leer" : ""}`}
              >
                <View style={styles.header}>
                  <Ionicons
                    name={meta.icon}
                    size={layout.iconMd}
                    color={meta.color}
                  />
                  <Text style={[styles.title, unread && styles.titleUnread]}>
                    {meta.title} · {plotName.get(item.plot_id) ?? "Lote"}
                  </Text>
                </View>
                <Text style={styles.body}>{describe(item)}</Text>
                <Text style={styles.meta}>
                  {formatDateTime(item.created_at)} ·{" "}
                  {timeAgo(item.created_at, now)}
                </Text>
                {unread && canCommand ? (
                  <Button
                    title="Marcar como leída"
                    variant="secondary"
                    icon="checkmark-done-outline"
                    onPress={() => onMarkRead(item.id)}
                    loading={busyId === item.id}
                  />
                ) : null}
              </Pressable>
            );
          }}
        />
      </FarmGate>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    borderLeftWidth: spacing.xs,
    backgroundColor: colors.surface,
  },
  read: { opacity: 0.6 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { flex: 1, fontSize: fontSize.md, color: colors.text },
  titleUnread: { fontWeight: fontWeight.bold },
  body: { fontSize: fontSize.sm, color: colors.text },
  meta: { fontSize: fontSize.xs, color: colors.textMuted },
});
