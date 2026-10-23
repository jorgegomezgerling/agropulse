import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFarm } from "@/context/FarmContext";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/ScreenState";
import { friendlyError, isNetworkError } from "@/lib/errors";
import { commandActionLabel } from "@/lib/labels";
import type { CommandAction } from "@/types";
import { colors, fontSize, fontWeight, layout, radius, spacing } from "@/theme";

const ACTIONS: CommandAction[] = ["open", "close", "open_for"];

const schema = z.object({
  duration: z
    .string()
    .trim()
    .regex(/^\d+$/, "Solo números enteros")
    .refine((v) => Number(v) >= 1 && Number(v) <= 120, "Entre 1 y 120 minutos"),
});
type FormValues = z.infer<typeof schema>;

function SummaryRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, mono && styles.mono]} selectable>
        {value}
      </Text>
    </View>
  );
}

export default function ConfirmCommandScreen() {
  const params = useLocalSearchParams<{ valveId: string; action: string }>();
  const { valves, plots, issueCommand } = useFarm();
  // Un ID por intento de comando: no cambia aunque la pantalla se redibuje
  const [clientRequestId] = useState(() => Crypto.randomUUID());
  const [failure, setFailure] = useState<{
    text: string;
    retryable: boolean;
  } | null>(null);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { duration: "30" },
  });

  const valve = valves.find((v) => v.id === params.valveId);
  const plot = plots.find((p) => p.id === valve?.plot_id);
  const action = ACTIONS.find((a) => a === params.action);

  if (!valve || !plot || !action) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="Comando inválido"
        message="Volvé al lote e intentá de nuevo."
      />
    );
  }

  const duration = watch("duration");

  const send = async (values: FormValues) => {
    setFailure(null);
    try {
      await issueCommand({
        valveId: valve.id,
        action,
        durationMin: action === "open_for" ? Number(values.duration) : null,
        clientRequestId,
      });
      router.back(); // el detalle muestra "comando en vuelo" y luego el resultado
    } catch (error) {
      setFailure({
        text: friendlyError(error),
        retryable: isNetworkError(error),
      });
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <SummaryRow label="Lote" value={plot.name} />
        <SummaryRow label="Válvula" value={valve.name} />
        <SummaryRow
          label="Acción"
          value={commandActionLabel(
            action,
            action === "open_for" ? Number(duration) || null : null,
          )}
        />
        {action === "open_for" ? (
          <View style={styles.field}>
            <Text style={styles.summaryLabel}>Duración (minutos, 1 a 120)</Text>
            <Controller
              control={control}
              name="duration"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  style={[styles.input, errors.duration && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="number-pad"
                />
              )}
            />
            {errors.duration ? (
              <Text style={styles.error}>{errors.duration.message}</Text>
            ) : null}
          </View>
        ) : null}
        <SummaryRow label="client_request_id" value={clientRequestId} mono />
      </View>

      {failure ? (
        <View style={styles.failure} accessibilityRole="alert">
          <Ionicons
            name="alert-circle-outline"
            size={layout.iconMd}
            color={colors.danger}
          />
          <Text style={styles.failureText}>{failure.text}</Text>
        </View>
      ) : null}

      <Button
        title={failure?.retryable ? "Reintentar con el mismo ID" : "Confirmar"}
        icon={failure?.retryable ? "refresh" : "checkmark"}
        onPress={handleSubmit(send)}
        loading={isSubmitting}
      />
      <Button
        title="Volver"
        variant="secondary"
        onPress={() => router.back()}
        disabled={isSubmitting}
      />
      <Text style={styles.hint}>
        El comando queda pendiente hasta que el worker lo aplica (normalmente
        menos de 5 segundos).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.lg },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  summaryRow: { gap: spacing.xs },
  summaryLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  summaryValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  mono: { fontSize: fontSize.xs, fontFamily: "Courier" },
  field: { gap: spacing.xs },
  input: {
    height: layout.inputHeight,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },
  error: { fontSize: fontSize.xs, color: colors.danger },
  failure: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerBg,
  },
  failureText: { flex: 1, fontSize: fontSize.sm, color: colors.danger },
  hint: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: "center" },
});
