import { FlatList, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useFarm } from "@/context/FarmContext";
import { EmptyState } from "@/components/ScreenState";
import { commandActionLabel, commandStatusLabels } from "@/lib/labels";
import { formatDateTime, formatTime } from "@/lib/time";
import type { CommandStatus } from "@/types";
import { colors, fontSize, fontWeight, layout, radius, spacing } from "@/theme";

const statusColor: Record<CommandStatus, string> = {
  pending: colors.warning,
  applied: colors.primary,
  failed: colors.danger,
  cancelled: colors.textMuted,
};

export default function HistoryScreen() {
  const { plotId } = useLocalSearchParams<{ plotId: string }>();
  const { plots, valves, commands } = useFarm();
  const plot = plots.find((p) => p.id === plotId);
  const plotValves = valves.filter((v) => v.plot_id === plotId);
  const valveName = new Map(plotValves.map((v) => [v.id, v.name]));
  const items = commands.filter((c) => valveName.has(c.valve_id)).slice(0, 20);

  return (
    <>
      <Stack.Screen
        options={{ title: plot ? `Historial · ${plot.name}` : "Historial" }}
      />
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.list}
        data={items}
        keyExtractor={(c) => c.id}
        ListEmptyComponent={
          <EmptyState
            icon="time-outline"
            title="Todavía no hay comandos en este lote"
          />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.action}>
                {commandActionLabel(item.action, item.duration_min)} ·{" "}
                {valveName.get(item.valve_id)}
              </Text>
              <Text
                style={[styles.status, { color: statusColor[item.status] }]}
              >
                {commandStatusLabels[item.status]}
              </Text>
            </View>
            <Text style={styles.meta}>
              {formatDateTime(item.created_at)} ·{" "}
              {item.requested_by_email ?? "actor desconocido"}
            </Text>
            {item.applied_at ? (
              <Text style={styles.meta}>
                Resuelto a las {formatTime(item.applied_at)}
              </Text>
            ) : null}
            {item.failure_reason ? (
              <Text style={styles.failure}>Motivo: {item.failure_reason}</Text>
            ) : null}
          </View>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  row: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  action: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  status: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  meta: { fontSize: fontSize.xs, color: colors.textMuted },
  failure: { fontSize: fontSize.xs, color: colors.danger },
});
