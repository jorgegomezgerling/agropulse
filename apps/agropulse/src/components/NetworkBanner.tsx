import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import { colors, fontSize, layout, spacing } from "@/theme";

export function NetworkBanner() {
  const { error } = useFarm();
  if (!error) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons
        name="cloud-offline-outline"
        size={layout.iconMd}
        color={colors.warning}
      />
      <Text style={styles.text}>
        {error} Mostrando los últimos datos recibidos.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.warningBg,
  },
  text: { flex: 1, fontSize: fontSize.sm, color: colors.warning },
});
