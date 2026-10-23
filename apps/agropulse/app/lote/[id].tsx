import { useMemo, useState, type ReactNode } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import { useOrg } from "@/context/OrgContext";
import { useDeviceLocation } from "@/context/LocationContext";
import { useMoistureHistory } from "@/hooks/useMoistureHistory";
import { useNow } from "@/hooks/useNow";
import { Button } from "@/components/Button";
import { EmptyState, LoadingState } from "@/components/ScreenState";
import { LocationBanner } from "@/components/LocationBanner";
import { MoistureChart } from "@/components/MoistureChart";
import { NetworkBanner } from "@/components/NetworkBanner";
import { StatusBadge } from "@/components/StatusBadge";
import { ThresholdForm } from "@/components/ThresholdForm";
import { ValveCard } from "@/components/ValveCard";
import { roleLabels } from "@/lib/labels";
import { formatTime, timeAgo } from "@/lib/time";
import {
  colors,
  fontSize,
  fontWeight,
  layout,
  radius,
  spacing,
  type IconName,
} from "@/theme";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Notice({
  icon,
  text,
  color,
  background,
}: {
  icon: IconName;
  text: string;
  color: string;
  background: string;
}) {
  return (
    <View
      style={[styles.notice, { backgroundColor: background }]}
      accessibilityRole="alert"
    >
      <Ionicons name={icon} size={layout.iconMd} color={color} />
      <Text style={[styles.noticeText, { color }]}>{text}</Text>
    </View>
  );
}

export default function PlotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { plots, stations, valves, commands, loading, refresh } = useFarm();
  const { canCommand, canEditThresholds, role } = useOrg();
  const location = useDeviceLocation();
  const now = useNow(1000); // "hace X s" en vivo
  const [refreshing, setRefreshing] = useState(false);

  const plot = plots.find((p) => p.id === id);
  const stationIds = useMemo(
    () => stations.filter((s) => s.plot_id === id).map((s) => s.id),
    [stations, id],
  );
  const plotValves = valves.filter((v) => v.plot_id === id);
  const history = useMoistureHistory(id, stationIds);

  if (!plot) {
    return loading ? (
      <LoadingState />
    ) : (
      <EmptyState
        icon="leaf-outline"
        title="Lote no encontrado"
        message="Puede que pertenezca a otro establecimiento."
      />
    );
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), history.reload()]);
    setRefreshing(false);
  };

  return (
    <>
      <Stack.Screen options={{ title: plot.name }} />
      <NetworkBanner />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Última lectura (RF-09) */}
        <View style={styles.card}>
          <StatusBadge status={plot.status} size="lg" />
          <Text style={styles.moisture}>
            {plot.moisture_pct !== null
              ? `${plot.moisture_pct.toFixed(1)} %`
              : "—"}
          </Text>
          <Text style={styles.muted}>
            Humedad de suelo · {plot.crop ?? "sin cultivo"}
          </Text>
          <View style={styles.metrics}>
            <Text style={styles.metric}>
              Temp.{" "}
              {plot.temp_c !== null ? `${plot.temp_c.toFixed(1)} °C` : "—"}
            </Text>
            <Text style={styles.metric}>
              Lluvia{" "}
              {plot.rain_mm !== null ? `${plot.rain_mm.toFixed(1)} mm` : "—"}
            </Text>
          </View>
          <Text style={styles.muted}>
            Última lectura {timeAgo(plot.measured_at, now)}
            {plot.measured_at ? ` (${formatTime(plot.measured_at)})` : ""}
          </Text>
        </View>

        {/* Regla fija, sin IA (RF-22) y aviso de datos viejos (RF-20) */}
        {plot.status === "dry" ? (
          <Notice
            icon="water-outline"
            text="Humedad bajo umbral: considerar riego."
            color={colors.danger}
            background={colors.dangerBg}
          />
        ) : null}
        {plot.status === "stale" ? (
          <Notice
            icon="cloud-offline-outline"
            text="Sin datos confiables: la estación no reporta hace más de 15 minutos. No decidas riego con esta lectura."
            color={colors.textMuted}
            background={colors.border}
          />
        ) : null}

        {/* Estoy en el lote (RF-06) */}
        <View style={styles.locationRow}>
          <LocationBanner plotId={plot.id} />
          {location.status === "idle" ? (
            <Button
              title="¿Estoy en este lote?"
              icon="locate-outline"
              variant="secondary"
              onPress={location.request}
            />
          ) : null}
          {canCommand ? (
            <Button
              title="Cargar lectura manual"
              icon="create-outline"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/lectura-manual",
                  params: { plotId: plot.id },
                })
              }
            />
          ) : null}
        </View>

        <Section title="Humedad últimas 6 h">
          {history.error ? (
            <Text style={styles.error}>{history.error}</Text>
          ) : null}
          {history.loading ? (
            <Text style={styles.muted}>Cargando gráfico...</Text>
          ) : (
            <MoistureChart
              points={history.points}
              thresholdMin={plot.threshold_min}
              thresholdMax={plot.threshold_max}
            />
          )}
        </Section>

        <Section title="Umbrales de riego">
          <ThresholdForm plot={plot} editable={canEditThresholds} />
        </Section>

        <Section title="Válvulas">
          {plotValves.length === 0 ? (
            <Text style={styles.muted}>Este lote no tiene válvulas.</Text>
          ) : null}
          {plotValves.map((valve) => (
            <ValveCard
              key={valve.id}
              valve={valve}
              commands={commands.filter((c) => c.valve_id === valve.id)}
              canCommand={canCommand}
              roleLabel={role ? roleLabels[role] : "sin rol"}
              now={now}
            />
          ))}
          <Button
            title="Ver historial de comandos"
            icon="time-outline"
            variant="secondary"
            onPress={() => router.push(`/historial/${plot.id}`)}
          />
        </Section>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.lg },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  moisture: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  metrics: { flexDirection: "row", gap: spacing.lg },
  metric: { fontSize: fontSize.md, color: colors.text },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  error: { fontSize: fontSize.sm, color: colors.danger },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  noticeText: { flex: 1, fontSize: fontSize.sm },
  locationRow: { gap: spacing.sm },
  section: { gap: spacing.md },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
});
