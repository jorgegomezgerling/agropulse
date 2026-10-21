import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import { Button } from "@/components/Button";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { roleLabels } from "@/lib/labels";
import { colors, fontSize, fontWeight, layout, radius, spacing } from "@/theme";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function AccountScreen() {
  const { session, signOut } = useAuth();
  const { activeOrg, role, memberships } = useOrg();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Row label="Usuario" value={session?.user.email ?? "-"} />
        <Row label="Rol" value={role ? roleLabels[role] : "Sin rol"} />
        <Row
          label="Establecimiento"
          value={activeOrg?.organizations.name ?? "Ninguno"}
        />
        <Row label="Región" value={activeOrg?.organizations.region ?? "-"} />
      </View>

      {memberships.length > 1 ? (
        <View>
          <Text style={styles.section}>Cambiar de establecimiento</Text>
          <OrgSwitcher />
        </View>
      ) : null}

      <Button
        title="Diagnóstico"
        icon="pulse-outline"
        variant="secondary"
        onPress={() => router.push("/diagnostico")}
      />
      <Button
        title="Cerrar sesión"
        icon="log-out-outline"
        variant="danger"
        onPress={signOut}
      />

      <Text style={styles.disclaimer}>
        AgroPulse es una demo académica. Los lotes, las humedades, el clima y
        las coordenadas son ficticios y no corresponden a un predio real.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { gap: spacing.xs },
  rowLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  rowValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  section: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
  },
  disclaimer: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: "center",
  },
});
