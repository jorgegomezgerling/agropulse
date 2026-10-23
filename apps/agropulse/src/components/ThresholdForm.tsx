import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFarm } from "@/context/FarmContext";
import { friendlyError } from "@/lib/errors";
import { Button } from "./Button";
import type { PlotOverview } from "@/types";
import { colors, fontSize, fontWeight, layout, radius, spacing } from "@/theme";

const toNumber = (text: string) => Number(text.replace(",", "."));

const schema = z
  .object({ min: z.string().trim(), max: z.string().trim() })
  .superRefine((values, ctx) => {
    const min = toNumber(values.min);
    const max = toNumber(values.max);
    if (values.min === "" || !Number.isFinite(min) || min < 0 || min > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["min"],
        message: "Un número entre 0 y 100",
      });
    }
    if (values.max === "" || !Number.isFinite(max) || max < 0 || max > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["max"],
        message: "Un número entre 0 y 100",
      });
    }
    if (Number.isFinite(min) && Number.isFinite(max) && min >= max) {
      ctx.addIssue({
        code: "custom",
        path: ["max"],
        message: "Tiene que ser mayor que el mínimo",
      });
    }
  });
type FormValues = z.infer<typeof schema>;

interface ThresholdFormProps {
  plot: PlotOverview;
  editable: boolean;
}

export function ThresholdForm({ plot, editable }: ThresholdFormProps) {
  const { updateThresholds } = useFarm();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      min: String(plot.threshold_min),
      max: String(plot.threshold_max),
    },
  });

  // Si el umbral cambia desde afuera, el formulario lo refleja
  useEffect(() => {
    reset({ min: String(plot.threshold_min), max: String(plot.threshold_max) });
  }, [plot.threshold_min, plot.threshold_max, reset]);

  if (!editable) {
    return (
      <View style={styles.box}>
        <Text style={styles.readOnly}>
          Mínimo {plot.threshold_min} % · Máximo {plot.threshold_max} %
        </Text>
        <Text style={styles.hint}>
          Solo el productor puede cambiar los umbrales.
        </Text>
      </View>
    );
  }

  const onSubmit = async (values: FormValues) => {
    setMessage(null);
    try {
      await updateThresholds(
        plot.id,
        toNumber(values.min),
        toNumber(values.max),
      );
      setMessage({
        ok: true,
        text: "Umbrales guardados. El semáforo ya usa los nuevos valores.",
      });
    } catch (error) {
      setMessage({ ok: false, text: friendlyError(error) });
    }
  };

  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>Mínimo (%)</Text>
          <Controller
            control={control}
            name="min"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={[styles.input, errors.min && styles.inputError]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="decimal-pad"
              />
            )}
          />
          {errors.min ? (
            <Text style={styles.error}>{errors.min.message}</Text>
          ) : null}
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Máximo (%)</Text>
          <Controller
            control={control}
            name="max"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={[styles.input, errors.max && styles.inputError]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="decimal-pad"
              />
            )}
          />
          {errors.max ? (
            <Text style={styles.error}>{errors.max.message}</Text>
          ) : null}
        </View>
      </View>
      {message ? (
        <Text
          style={[
            styles.message,
            { color: message.ok ? colors.primary : colors.danger },
          ]}
        >
          {message.text}
        </Text>
      ) : null}
      <Button
        title="Guardar umbrales"
        icon="save-outline"
        variant="secondary"
        onPress={handleSubmit(onSubmit)}
        loading={isSubmitting}
        disabled={!isDirty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md },
  row: { flexDirection: "row", gap: spacing.md },
  field: { flex: 1, gap: spacing.xs },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
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
  message: { fontSize: fontSize.sm },
  readOnly: { fontSize: fontSize.md, color: colors.text },
  hint: { fontSize: fontSize.xs, color: colors.textMuted },
});
