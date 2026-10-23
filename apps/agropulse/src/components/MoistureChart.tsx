import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, {
  Circle,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import type { ChartPoint } from "@/hooks/useMoistureHistory";
import { formatTime } from "@/lib/time";
import { colors, fontSize, layout, softAlpha, spacing } from "@/theme";

interface MoistureChartProps {
  points: ChartPoint[];
  thresholdMin: number;
  thresholdMax: number;
  hours?: number;
}

const PAD = { left: 36, right: 12, top: 12, bottom: 24 };

export function MoistureChart({
  points,
  thresholdMin,
  thresholdMax,
  hours = 6,
}: MoistureChartProps) {
  const [width, setWidth] = useState(0);
  const height = layout.chartHeight;
  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  if (points.length < 2) {
    return (
      <Text style={styles.empty}>
        Todavía no hay suficientes lecturas para el gráfico.
      </Text>
    );
  }

  const end = Date.now();
  const start = end - hours * 60 * 60 * 1000;
  const values = points.map((p) => p.v);
  const yMin = Math.max(0, Math.floor(Math.min(...values, thresholdMin) - 5));
  const yMax = Math.min(100, Math.ceil(Math.max(...values, thresholdMax) + 5));
  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = height - PAD.top - PAD.bottom;

  const x = (t: number) => PAD.left + ((t - start) / (end - start)) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const visible = points.filter((p) => p.t >= start);
  const path = visible
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`,
    )
    .join(" ");
  const last = visible[visible.length - 1];

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityLabel={`Humedad de las últimas ${hours} horas, entre ${Math.min(...values).toFixed(0)} y ${Math.max(...values).toFixed(0)} por ciento`}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          {/* Franja óptima entre umbrales */}
          <Rect
            x={PAD.left}
            y={y(thresholdMax)}
            width={plotW}
            height={Math.max(y(thresholdMin) - y(thresholdMax), 0)}
            fill={colors.status.optimal + softAlpha}
          />
          <Line
            x1={PAD.left}
            x2={PAD.left + plotW}
            y1={y(thresholdMin)}
            y2={y(thresholdMin)}
            stroke={colors.status.dry}
            strokeDasharray="4 4"
          />
          <Line
            x1={PAD.left}
            x2={PAD.left + plotW}
            y1={y(thresholdMax)}
            y2={y(thresholdMax)}
            stroke={colors.status.wet}
            strokeDasharray="4 4"
          />
          <SvgText
            x={PAD.left - spacing.xs}
            y={y(thresholdMin) + 4}
            fontSize={fontSize.xs}
            fill={colors.status.dry}
            textAnchor="end"
          >
            {thresholdMin}
          </SvgText>
          <SvgText
            x={PAD.left - spacing.xs}
            y={y(thresholdMax) + 4}
            fontSize={fontSize.xs}
            fill={colors.status.wet}
            textAnchor="end"
          >
            {thresholdMax}
          </SvgText>

          {/* Ejes */}
          <Line
            x1={PAD.left}
            x2={PAD.left}
            y1={PAD.top}
            y2={PAD.top + plotH}
            stroke={colors.border}
          />
          <Line
            x1={PAD.left}
            x2={PAD.left + plotW}
            y1={PAD.top + plotH}
            y2={PAD.top + plotH}
            stroke={colors.border}
          />
          <SvgText
            x={PAD.left}
            y={height - spacing.xs}
            fontSize={fontSize.xs}
            fill={colors.textMuted}
          >
            {formatTime(new Date(start).toISOString())}
          </SvgText>
          <SvgText
            x={PAD.left + plotW}
            y={height - spacing.xs}
            fontSize={fontSize.xs}
            fill={colors.textMuted}
            textAnchor="end"
          >
            ahora
          </SvgText>

          {/* Serie */}
          <Path
            d={path}
            stroke={colors.primaryDark}
            strokeWidth={2}
            fill="none"
          />
          {last ? (
            <Circle
              cx={x(last.t)}
              cy={y(last.v)}
              r={4}
              fill={colors.primaryDark}
            />
          ) : null}
        </Svg>
      ) : null}
      <Text style={styles.caption}>
        Promedio cada 5 min · % de humedad · línea roja: mínimo · azul: máximo
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    paddingVertical: spacing.lg,
  },
  caption: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
