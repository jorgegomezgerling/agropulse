import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/Button";
import { friendlyError } from "@/lib/errors";
import { colors, fontSize, fontWeight, layout, radius, spacing } from "@/theme";

const schema = z.object({
  email: z.string().trim().min(1, "Ingresá tu email").email("Email inválido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setAuthError(null);
    try {
      await signIn(values.email, values.password);
      // No navegamos: Stack.Protected cambia solo al aparecer la sesión
    } catch (error) {
      setAuthError(friendlyError(error));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Ionicons
              name="leaf-outline"
              size={layout.iconLg * 2}
              color={colors.primary}
            />
            <Text style={styles.title}>AgroPulse</Text>
            <Text style={styles.subtitle}>
              Humedad, clima y riego de tus lotes
            </Text>
          </View>

          <Text style={styles.label}>Email</Text>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                placeholder="productor@agropulse.test"
                placeholderTextColor={colors.textMuted}
              />
            )}
          />
          {errors.email ? (
            <Text style={styles.fieldError}>{errors.email.message}</Text>
          ) : null}

          <Text style={styles.label}>Contraseña</Text>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.password && styles.inputError]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                textContentType="password"
                onSubmitEditing={handleSubmit(onSubmit)}
              />
            )}
          />
          {errors.password ? (
            <Text style={styles.fieldError}>{errors.password.message}</Text>
          ) : null}

          {authError ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Ionicons
                name="alert-circle-outline"
                size={layout.iconMd}
                color={colors.danger}
              />
              <Text style={styles.errorText}>{authError}</Text>
            </View>
          ) : null}

          <Button
            title="Ingresar"
            icon="log-in-outline"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
          />

          <Text style={styles.disclaimer}>
            Demo académica. Lotes, humedad y ubicaciones son ficticios.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  header: { alignItems: "center", marginBottom: spacing.xl, gap: spacing.xs },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
    marginTop: spacing.sm,
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
  fieldError: { fontSize: fontSize.xs, color: colors.danger },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerBg,
  },
  errorText: { flex: 1, fontSize: fontSize.sm, color: colors.danger },
  disclaimer: {
    marginTop: spacing.lg,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: "center",
  },
});
