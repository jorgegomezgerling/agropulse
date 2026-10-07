import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/Button";
import { colors, fontSize, spacing } from "@/theme";

export default function AccountScreen() {
  const { session, signOut } = useAuth();
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{session?.user.email}</Text>
      <Button
        title="Cerrar sesión"
        variant="danger"
        icon="log-out-outline"
        onPress={signOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  text: { fontSize: fontSize.md, color: colors.text },
});
