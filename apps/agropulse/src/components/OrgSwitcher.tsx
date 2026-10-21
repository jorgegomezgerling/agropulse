import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useOrg } from "@/context/OrgContext";
import { colors, fontSize, fontWeight, layout, radius, spacing } from "@/theme";

export function OrgSwitcher() {
  const { memberships, activeOrg, setActiveOrgId } = useOrg();
  if (memberships.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {memberships.map((m) => {
        const active = m.organization_id === activeOrg?.organization_id;
        return (
          <Pressable
            key={m.organization_id}
            onPress={() => setActiveOrgId(m.organization_id)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name="business-outline"
              size={layout.iconSm}
              color={active ? colors.onPrimary : colors.primary}
            />
            <Text style={[styles.text, active && styles.textActive]}>
              {m.organizations.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 }, // ocupa solo el alto de los chips, no media pantalla
  row: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: layout.borderWidth,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary },
  text: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },
  textActive: { color: colors.onPrimary },
});
