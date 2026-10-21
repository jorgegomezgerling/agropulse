import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBadge } from "./StatusBadge";
import { timeAgo } from "@/lib/time";
import type { PlotOverview } from "@/types";
import { colors, fontSize, fontWeight, layout, radius, spacing } from "@/theme";

interface PlotRowProps {
  plot: PlotOverview;
  now: number;
  onPress: () => void;
}

export function PlotRow({ plot, now, onPress }: PlotRowProps) {
  const moisture =
    plot.moisture_pct !== null ? `${plot.moisture_pct.toFixed(1)} %` : "—";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Lote ${plot.name}, humedad ${moisture}`}
    >
      <View style={styles.main}>
        <Text style={styles.name}>{plot.name}</Text>
        <Text style={styles.crop}>{plot.crop ?? "Sin cultivo cargado"}</Text>
        <StatusBadge status={plot.status} />
      </View>
      <View style={styles.side}>
        <Text style={styles.moisture}>{moisture}</Text>
        <Text style={styles.age}>{timeAgo(plot.measured_at, now)}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={layout.iconMd}
        color={colors.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.8 },
  main: { flex: 1, gap: spacing.xs },
  name: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  crop: { fontSize: fontSize.sm, color: colors.textMuted },
  side: { alignItems: "flex-end", gap: spacing.xs },
  moisture: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  age: { fontSize: fontSize.xs, color: colors.textMuted },
});
