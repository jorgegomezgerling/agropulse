import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { useFarm } from "@/context/FarmContext";
import { useDeviceLocation } from "@/context/LocationContext";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/ScreenState";
import {
  enqueue,
  flushQueue,
  getQueue,
  onQueueChange,
} from "@/lib/manualQueue";
import { supabase } from "@/lib/supabase";
import { formatDateTime } from "@/lib/time";
import { colors, fontSize, fontWeight, layout, radius, spacing } from "@/theme";

const schema = z.object({
  moisture: z
    .string()
    .trim()
    .refine(
      (v) =>
        v !== "" &&
        Number(v.replace(",", ".")) >= 0 &&
        Number(v.replace(",", ".")) <= 100,
      "Un número entre 0 y 100",
    ),
  note: z.string().trim().max(200, "Máximo 200 caracteres"),
});
type FormValues = z.infer<typeof schema>;

interface ManualRow {
  id: string;
  measured_at: string;
  moisture_pct: number;
  note: string | null;
}

export default function ManualReadingScreen() {
  const { plotId } = useLocalSearchParams<{ plotId: string }>();
  const { session } = useAuth();
  const { plots, stations } = useFarm();
  const location = useDeviceLocation();
  const [pending, setPending] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [recent, setRecent] = useState<ManualRow[]>([]);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { moisture: "", note: "" },
  });

  const plot = plots.find((p) => p.id === plotId);
  const station = stations.find((s) => s.plot_id === plotId);

  const loadRecent = useCallback(async () => {
    if (!station) return;
    const { data } = await supabase
      .from("readings")
      .select("id, measured_at, moisture_pct, note")
      .eq("station_id", station.id)
      .eq("source", "manual")
      .order("measured_at", { ascending: false })
      .limit(10);
    if (data) setRecent(data as ManualRow[]);
  }, [station]);

  useEffect(() => {
    getQueue().then((q) => setPending(q.length));
    loadRecent();
    return onQueueChange((count) => {
      setPending(count);
      loadRecent();
    });
  }, [loadRecent]);

  if (!plot || !station || !session) {
    return <EmptyState icon="alert-circle-outline" title="Lote sin estación" />;
  }

  const onSubmit = async (values: FormValues) => {
    const coords = location.coords ?? (await location.request());
    await enqueue({
      client_id: Crypto.randomUUID(),
      station_id: station.id,
      moisture_pct: Number(values.moisture.replace(",", ".")),
      note: values.note || null,
      lat: coords?.latitude ?? null,
      lng: coords?.longitude ?? null,
      measured_at: new Date().toISOString(),
    });
    reset();
    const { sent } = await flushQueue(session.user.id);
    setMessage(
      sent > 0
        ? "Lectura enviada."
        : "Sin conexión: la lectura quedó guardada y se enviará sola al volver la red.",
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: `Lectura manual · ${plot.name}` }} />
      <View style={styles.card}>
        <Text style={styles.label}>Humedad estimada (%)</Text>
        <Controller
          control={control}
          name="moisture"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={[styles.input, errors.moisture && styles.inputError]}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              keyboardType="decimal-pad"
            />
          )}
        />
        {errors.moisture ? (
          <Text style={styles.error}>{errors.moisture.message}</Text>
        ) : null}
        <Text style={styles.label}>Nota (opcional)</Text>
        <Controller
          control={control}
          name="note"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={[styles.input, styles.multiline]}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              multiline
            />
          )}
        />
        {errors.note ? (
          <Text style={styles.error}>{errors.note.message}</Text>
        ) : null}
        <Text style={styles.hint}>
          Se guarda con tu ubicación GPS si diste permiso.
        </Text>
        <Button
          title="Guardar lectura"
          icon="save-outline"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
        />
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Text style={styles.pending}>Pendientes de envío: {pending}</Text>

      <Text style={styles.section}>Últimas lecturas manuales</Text>
      {recent.length === 0 ? (
        <Text style={styles.hint}>Todavía no hay.</Text>
      ) : null}
      {recent.map((r) => (
        <Text key={r.id} style={styles.recent}>
          {formatDateTime(r.measured_at)} · {Number(r.moisture_pct).toFixed(1)}{" "}
          %{r.note ? ` · ${r.note}` : ""}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  input: {
    minHeight: layout.inputHeight,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  multiline: {
    minHeight: layout.inputHeight * 2,
    textAlignVertical: "top",
    paddingTop: spacing.sm,
  },
  inputError: { borderColor: colors.danger },
  error: { fontSize: fontSize.xs, color: colors.danger },
  hint: { fontSize: fontSize.xs, color: colors.textMuted },
  message: { fontSize: fontSize.sm, color: colors.info },
  pending: {
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
  recent: { fontSize: fontSize.sm, color: colors.text },
});
