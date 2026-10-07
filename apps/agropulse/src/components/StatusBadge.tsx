import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PlotStatus } from "@/types";
import {
  fontSize,
  fontWeight,
  layout,
  radius,
  softAlpha,
  spacing,
  statusMeta,
} from "@/theme";

interface StatusBadgeProps {
  status: PlotStatus;
  size?: "sm" | "lg";
}

// Color + ícono + texto: el estado nunca depende solo del color (accesibilidad)
export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const meta = statusMeta[status];
  const large = size === "lg";
  return (
    <View
      style={[
        styles.badge,
        { borderColor: meta.color, backgroundColor: meta.color + softAlpha },
      ]}
      accessible
      accessibilityLabel={`Estado: ${meta.label}`}
    >
      <Ionicons
        name={meta.icon}
        size={large ? layout.iconMd : layout.iconSm}
        color={meta.color}
      />
      <Text
        style={[
          styles.label,
          { color: meta.color },
          large && styles.labelLarge,
        ]}
      >
        {meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: layout.borderWidth,
  },
  label: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  labelLarge: { fontSize: fontSize.sm },
});
