import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { PlotStatus } from "@/types";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export const colors = {
  primary: "#2E7D32",
  primaryDark: "#1B5E20",
  onPrimary: "#FFFFFF",
  background: "#F4F6F2",
  surface: "#FFFFFF",
  border: "#DCE3D8",
  text: "#1C2B1E",
  textMuted: "#5F6F61",
  disabled: "#B8C2B9",
  danger: "#C62828",
  dangerBg: "#FDECEA",
  warning: "#9A5B00",
  warningBg: "#FFF4E0",
  info: "#1565C0",
  infoBg: "#E8F0FB",
  overlay: "rgba(255, 255, 255, 0.94)",
  status: {
    stale: "#757575",
    dry: "#D32F2F",
    optimal: "#2E7D32",
    wet: "#1565C0",
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 32,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "600",
  bold: "700",
} as const;

export const layout = {
  buttonHeight: 48,
  inputHeight: 48,
  fabSize: 56,
  iconSm: 16,
  iconMd: 20,
  iconLg: 28,
  chartHeight: 180,
  polygonStroke: 2,
  borderWidth: 1,
  maxContentWidth: 480,
} as const;

// Transparencia (en hex) que se agrega al color del semáforo para rellenar polígonos
export const polygonFillAlpha = "59";
// Transparencia para fondos suaves de badges y bandas del gráfico
export const softAlpha = "1F";

export const shadow = {
  shadowColor: "#000000",
  shadowOpacity: 0.15,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 4,
} as const;

export const statusMeta: Record<
  PlotStatus,
  { label: string; color: string; icon: IconName }
> = {
  dry: { label: "Seco", color: colors.status.dry, icon: "sunny-outline" },
  optimal: {
    label: "Óptimo",
    color: colors.status.optimal,
    icon: "checkmark-circle-outline",
  },
  wet: { label: "Húmedo", color: colors.status.wet, icon: "water-outline" },
  stale: {
    label: "Sin datos",
    color: colors.status.stale,
    icon: "cloud-offline-outline",
  },
};

// Orden en que se muestran en la leyenda del mapa
export const statusOrder: PlotStatus[] = ["dry", "optimal", "wet", "stale"];
