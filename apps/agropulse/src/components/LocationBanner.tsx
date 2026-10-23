import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDeviceLocation } from "@/context/LocationContext";
import { useFarm } from "@/context/FarmContext";
import { findPlotAt } from "@/lib/geo";
import {
  colors,
  fontSize,
  layout,
  radius,
  spacing,
  type IconName,
} from "@/theme";

export function LocationBanner({ plotId }: { plotId?: string }) {
  const { status, coords, simulated } = useDeviceLocation();
  const { plots } = useFarm();

  let icon: IconName = "navigate-outline";
  let text: string;
  let tone: string = colors.textMuted;

  if (status === "idle") return null;
  if (status === "loading") {
    text = "Buscando tu ubicación...";
  } else if (status === "denied" || status === "unavailable" || !coords) {
    icon = "location-outline";
    text = "Ubicación no disponible";
  } else {
    const here = findPlotAt(coords, plots);
    const suffix = simulated ? " (simulada)" : "";
    if (plotId) {
      const inside = here?.id === plotId;
      text = inside
        ? `Estás en este lote${suffix}`
        : `No estás en este lote${suffix}`;
      tone = inside ? colors.primary : colors.textMuted;
      icon = inside ? "location" : "location-outline";
    } else {
      text = here
        ? `Estás en el lote ${here.name}${suffix}`
        : `Estás fuera de los lotes${suffix}`;
      tone = here ? colors.primary : colors.textMuted;
      icon = here ? "location" : "location-outline";
    }
  }

  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <Ionicons name={icon} size={layout.iconMd} color={tone} />
      <Text style={[styles.text, { color: tone }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.overlay,
    alignSelf: "flex-start",
  },
  text: { fontSize: fontSize.sm },
});
