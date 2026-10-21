import type { ReactNode } from "react";
import { useOrg } from "@/context/OrgContext";
import { useFarm } from "@/context/FarmContext";
import { EmptyState, ErrorState, LoadingState } from "./ScreenState";

// Muestra loading / error / vacío; si todo está bien, muestra children
export function FarmGate({ children }: { children: ReactNode }) {
  const org = useOrg();
  const farm = useFarm();

  if (org.loading)
    return <LoadingState message="Cargando establecimientos..." />;
  if (org.error) return <ErrorState message={org.error} onRetry={org.reload} />;
  if (org.memberships.length === 0) {
    return (
      <EmptyState
        icon="business-outline"
        title="No pertenecés a ningún establecimiento"
        message="Pedile al productor que te invite."
      />
    );
  }
  if (farm.loading && farm.plots.length === 0)
    return <LoadingState message="Cargando lotes..." />;
  if (farm.error && farm.plots.length === 0)
    return <ErrorState message={farm.error} onRetry={farm.refresh} />;
  if (farm.plots.length === 0) {
    return (
      <EmptyState
        icon="leaf-outline"
        title="Este establecimiento no tiene lotes"
      />
    );
  }
  return <>{children}</>;
}
