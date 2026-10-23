import { useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFarm } from "@/context/FarmContext";
import { useDeviceLocation } from "@/context/LocationContext";
import { FarmGate } from "@/components/FarmGate";
import { LocationBanner } from "@/components/LocationBanner";
import { NetworkBanner } from "@/components/NetworkBanner";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { polygonCenter, polygonToLatLngs, regionForPolygons } from "@/lib/geo";
import {
  colors,
  fontSize,
  fontWeight,
  layout,
  polygonFillAlpha,
  radius,
  shadow,
  spacing,
  statusMeta,
  statusOrder,
} from "@/theme";

export default function MapScreen() {
  const { plots } = useFarm();
  const location = useDeviceLocation();
  const mapRef = useRef<MapView>(null);

  // Se calcula una vez por establecimiento (MapView solo usa initialRegion al montarse)
  const region = useMemo(
    () => regionForPolygons(plots.map((p) => p.geom)),
    [plots],
  );

  const goToMyLocation = async () => {
    const point = location.simulated
      ? location.coords
      : await location.request();
    if (point) {
      mapRef.current?.animateToRegion(
        { ...point, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        600,
      );
    }
  };

  return (
    <View style={styles.screen}>
      <OrgSwitcher />
      <NetworkBanner />
      <FarmGate>
        <View style={styles.mapWrapper}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={region ?? undefined}
            showsUserLocation={
              location.status === "granted" && !location.simulated
            }
          >
            {plots.map((plot) => {
              const meta = statusMeta[plot.status];
              return (
                <Polygon
                  key={plot.id}
                  coordinates={polygonToLatLngs(plot.geom)}
                  fillColor={meta.color + polygonFillAlpha}
                  strokeColor={meta.color}
                  strokeWidth={layout.polygonStroke}
                  tappable
                  onPress={() => router.push(`/lote/${plot.id}`)}
                />
              );
            })}
            {plots.map((plot) => {
              const meta = statusMeta[plot.status];
              return (
                <Marker
                  key={`${plot.id}-${plot.status}`}
                  coordinate={polygonCenter(plot.geom)}
                  onPress={() => router.push(`/lote/${plot.id}`)}
                  tracksViewChanges={false}
                >
                  <View style={[styles.marker, { borderColor: meta.color }]}>
                    <Ionicons
                      name={meta.icon}
                      size={layout.iconSm}
                      color={meta.color}
                    />
                    <Text style={styles.markerText}>{plot.name}</Text>
                  </View>
                </Marker>
              );
            })}
            {location.simulated && location.coords ? (
              <Marker
                coordinate={location.coords}
                title="Ubicación simulada"
                pinColor={colors.info}
              />
            ) : null}
          </MapView>

          <View style={styles.topOverlay} pointerEvents="none">
            <LocationBanner />
          </View>

          <View style={styles.legend} accessibilityLabel="Leyenda de colores">
            {statusOrder.map((status) => (
              <View key={status} style={styles.legendRow}>
                <Ionicons
                  name={statusMeta[status].icon}
                  size={layout.iconSm}
                  color={statusMeta[status].color}
                />
                <Text style={styles.legendText}>
                  {statusMeta[status].label}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            style={styles.fab}
            onPress={goToMyLocation}
            accessibilityRole="button"
            accessibilityLabel="Mi ubicación"
          >
            <Ionicons
              name="locate"
              size={layout.iconLg}
              color={colors.onPrimary}
            />
          </Pressable>
        </View>
      </FarmGate>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  mapWrapper: { flex: 1 },
  topOverlay: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
  },
  marker: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: layout.borderWidth * 2,
    backgroundColor: colors.surface,
  },
  markerText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  legend: {
    position: "absolute",
    left: spacing.md,
    bottom: spacing.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.overlay,
    ...shadow,
  },
  legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  legendText: { fontSize: fontSize.xs, color: colors.text },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    width: layout.fabSize,
    height: layout.fabSize,
    borderRadius: layout.fabSize / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    ...shadow,
  },
});
