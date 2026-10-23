import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import { friendlyError } from "@/lib/errors";
import { commandActionLabel, commandStatusLabels } from "@/lib/labels";
import { formatTime, minutesUntil } from "@/lib/time";
import { Button } from "./Button";
import type { CommandAction, IrrigationCommand, Valve } from "@/types";
import { colors, fontSize, fontWeight, layout, radius, spacing } from "@/theme";

interface ValveCardProps {
  valve: Valve;
  commands: IrrigationCommand[]; // de esta válvula, el más nuevo primero
  canCommand: boolean;
  roleLabel: string;
  now: number;
}

export function ValveCard({
  valve,
  commands,
  canCommand,
  roleLabel,
  now,
}: ValveCardProps) {
  const { cancelCommand } = useFarm();
  const [cancelling, setCancelling] = useState(false);
  const pending = commands.find((c) => c.status === "pending") ?? null;
  const last = commands[0] ?? null;
  const open = valve.status === "open";

  const goConfirm = (action: CommandAction) =>
    router.push({
      pathname: "/confirmar-comando",
      params: { valveId: valve.id, action },
    });

  const onCancel = async () => {
    if (!pending) return;
    setCancelling(true);
    try {
      await cancelCommand(pending.id);
    } catch (error) {
      Alert.alert("No se pudo cancelar", friendlyError(error));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons
          name={open ? "water" : "water-outline"}
          size={layout.iconLg}
          color={open ? colors.info : colors.textMuted}
        />
        <View style={styles.headerText}>
          <Text style={styles.name}>{valve.name}</Text>
          <Text
            style={[
              styles.state,
              { color: open ? colors.info : colors.textMuted },
            ]}
          >
            {open ? "Abierta" : "Cerrada"}
            {open && valve.closes_at
              ? ` · se cierra en ${minutesUntil(valve.closes_at, now)} min`
              : ""}
          </Text>
        </View>
      </View>

      {pending ? (
        <View style={styles.pending}>
          <ActivityIndicator color={colors.warning} />
          <Text style={styles.pendingText}>
            Comando en vuelo:{" "}
            {commandActionLabel(pending.action, pending.duration_min)}{" "}
            (pendiente)
          </Text>
          {canCommand ? (
            <Button
              title="Cancelar"
              variant="danger"
              onPress={onCancel}
              loading={cancelling}
            />
          ) : null}
        </View>
      ) : last ? (
        <Text style={styles.last}>
          Último: {commandActionLabel(last.action, last.duration_min)} ·{" "}
          {commandStatusLabels[last.status]}
          {last.failure_reason ? ` (${last.failure_reason})` : ""} ·{" "}
          {formatTime(last.applied_at ?? last.created_at)}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            title="Abrir"
            icon="play-outline"
            onPress={() => goConfirm("open")}
            disabled={!canCommand}
          />
        </View>
        <View style={styles.action}>
          <Button
            title="Cerrar"
            icon="stop-outline"
            variant="secondary"
            onPress={() => goConfirm("close")}
            disabled={!canCommand}
          />
        </View>
      </View>
      <Button
        title="Regar N minutos"
        icon="timer-outline"
        variant="secondary"
        onPress={() => goConfirm("open_for")}
        disabled={!canCommand}
      />
      {!canCommand ? (
        <Text style={styles.hint}>
          Tu rol ({roleLabel}) puede ver, pero no emitir comandos.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerText: { flex: 1 },
  name: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  state: { fontSize: fontSize.sm },
  pending: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningBg,
  },
  pendingText: { fontSize: fontSize.sm, color: colors.warning },
  last: { fontSize: fontSize.sm, color: colors.textMuted },
  actions: { flexDirection: "row", gap: spacing.sm },
  action: { flex: 1 },
  hint: { fontSize: fontSize.xs, color: colors.textMuted },
});
