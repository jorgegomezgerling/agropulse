import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import { useFarm } from "@/context/FarmContext";
import { useDeviceLocation } from "@/context/LocationContext";
import { useNow } from "@/hooks/useNow";
import { Button } from "@/components/Button";
import { supabase } from "@/lib/supabase";
import { polygonCenter } from "@/lib/geo";
import { roleLabels } from "@/lib/labels";
import { formatTime, timeAgo } from "@/lib/time";
import { colors, fontSize, fontWeight, layout, radius, spacing } from "@/theme";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} selectable>
        {value}
      </Text>
    </View>
  );
}

export default function DiagnosticsScreen() {
  const { session } = useAuth();
  const { activeOrg, role, canCommand } = useOrg();
  const { plots, valves, commands, realtimeStatus, lastTick } = useFarm();
  const location = useDeviceLocation();
  const now = useNow(1000);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lagMs = lastTick
    ? lastTick.receivedAt - Date.parse(lastTick.measuredAt)
    : null;
  const testValve = valves[0];
  const host = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").replace(
    "https://",
    "",
  );

  // Llama al RPC directo, sin pasar por los botones de la UI
  const testPermission = async () => {
    if (!testValve) return;
    setBusy(true);
    const { error, status } = await supabase.rpc("issue_irrigation_command", {
      p_valve_id: testValve.id,
      p_action: "close",
      p_duration_min: null,
      p_client_request_id: Crypto.randomUUID(),
    });
    setResult(
      error
        ? `Rechazado por el servidor · HTTP ${status} · ${error.message}`
        : `Aceptado · HTTP ${status} · se creó un comando Cerrar en ${testValve.name}`,
    );
    setBusy(false);
  };

  const testIdempotency = async () => {
    if (!testValve) return;
    setBusy(true);
    const id = Crypto.randomUUID();
    const args = {
      p_valve_id: testValve.id,
      p_action: "close",
      p_duration_min: null,
      p_client_request_id: id,
    };
    const first = await supabase.rpc("issue_irrigation_command", args);
    const second = await supabase.rpc("issue_irrigation_command", args);
    const firstId = (first.data as { id?: string } | null)?.id;
    const secondId = (second.data as { id?: string } | null)?.id;
    setResult(
      first.error || second.error
        ? `Error: ${(first.error ?? second.error)?.message}`
        : `Dos envíos con el mismo client_request_id → ${firstId === secondId ? "el MISMO comando" : "comandos distintos (revisar)"}\n${firstId}`,
    );
    setBusy(false);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Row
          label="Usuario"
          value={`${session?.user.email ?? "-"}\n${session?.user.id ?? "-"}`}
        />
        <Row
          label="Establecimiento"
          value={`${activeOrg?.organizations.name ?? "-"}\n${activeOrg?.organization_id ?? "-"}`}
        />
        <Row label="Rol" value={role ? `${roleLabels[role]} (${role})` : "-"} />
        <Row label="Supabase" value={host} />
        <Row label="Realtime" value={realtimeStatus} />
        <Row
          label="Último tick recibido"
          value={
            lastTick
              ? `${formatTime(lastTick.measuredAt)} · llegó ${timeAgo(new Date(lastTick.receivedAt).toISOString(), now)}`
              : "Todavía ninguno"
          }
        />
        <Row
          label="Lag aparente"
          value={lagMs !== null ? `${lagMs} ms` : "-"}
        />
        <Row
          label="Datos en memoria"
          value={`${plots.length} lotes · ${valves.length} válvulas · ${commands.length} comandos`}
        />
        <Row
          label="Ubicación"
          value={`${location.status}${location.simulated ? " (simulada)" : ""}`}
        />
      </View>

      <Text style={styles.section}>Simular ubicación (RF-06)</Text>
      {plots.map((plot) => (
        <Button
          key={plot.id}
          title={`Estoy en ${plot.name}`}
          icon="navigate-outline"
          variant="secondary"
          onPress={() => location.simulate(polygonCenter(plot.geom))}
        />
      ))}
      <Button
        title="Quitar simulación"
        variant="secondary"
        onPress={() => location.simulate(null)}
      />

      <Text style={styles.section}>Pruebas de servidor</Text>
      <Button
        title={`Probar permiso de comando${testValve ? ` (${testValve.name})` : ""}`}
        icon="shield-checkmark-outline"
        variant="secondary"
        onPress={testPermission}
        loading={busy}
        disabled={!testValve}
      />
      {canCommand ? (
        <Button
          title="Probar idempotencia"
          icon="repeat-outline"
          variant="secondary"
          onPress={testIdempotency}
          loading={busy}
          disabled={!testValve}
        />
      ) : null}
      {result ? (
        <Text style={styles.result} selectable>
          {result}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: { gap: spacing.xs },
  label: { fontSize: fontSize.xs, color: colors.textMuted },
  value: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  section: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.md,
  },
  result: {
    fontSize: fontSize.sm,
    color: colors.text,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.infoBg,
  },
});
