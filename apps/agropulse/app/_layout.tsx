import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { OrgProvider } from "@/context/OrgContext";
import { FarmProvider } from "@/context/FarmContext";
import { LocationProvider } from "@/context/LocationContext";
import { LoadingState } from "@/components/ScreenState";
import { colors, fontWeight } from "@/theme";
import { ManualQueueSync } from "@/components/ManualQueueSync";

export default function RootLayout() {
  return (
    <AuthProvider>
      <OrgProvider>
        <FarmProvider>
          <LocationProvider>
            <StatusBar style="dark" />
            <ManualQueueSync />
            <RootNavigator />
          </LocationProvider>
        </FarmProvider>
      </OrgProvider>
    </AuthProvider>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();
  if (loading) return <LoadingState message="Verificando sesión..." />;
  const signedIn = session !== null;

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: fontWeight.medium, color: colors.text },
        headerBackTitle: "Volver",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="lote/[id]" options={{ title: "Lote" }} />
        <Stack.Screen
          name="confirmar-comando"
          options={{ title: "Confirmar comando", presentation: "modal" }}
        />
        <Stack.Screen
          name="historial/[plotId]"
          options={{ title: "Historial de comandos" }}
        />
        <Stack.Screen name="diagnostico" options={{ title: "Diagnóstico" }} />
        <Stack.Screen
          name="lectura-manual"
          options={{ title: "Lectura manual" }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
