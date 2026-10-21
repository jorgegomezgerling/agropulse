import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useFarm } from "@/context/FarmContext";
import { useNow } from "@/hooks/useNow";
import { FarmGate } from "@/components/FarmGate";
import { NetworkBanner } from "@/components/NetworkBanner";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { PlotRow } from "@/components/PlotRow";
import { colors, spacing } from "@/theme";

export default function PlotsScreen() {
  const { plots, refresh } = useFarm();
  const now = useNow(5000); // "hace X s" se refresca cada 5 s
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      <OrgSwitcher />
      <NetworkBanner />
      <FarmGate>
        <FlatList
          data={plots}
          keyExtractor={(plot) => plot.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <PlotRow
              plot={item}
              now={now}
              onPress={() => router.push(`/lote/${item.id}`)}
            />
          )}
        />
      </FarmGate>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.md },
});
