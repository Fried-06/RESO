import React, { useMemo } from "react";
import { Group } from "@visx/group";
import { arc as arcGenerator } from "@visx/shape";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface RingSegment {
  label: string;
  value: number;
  color: string;
}

export interface RingChartProps {
  data: RingSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSublabel?: string;
  className?: string;
  showLegend?: boolean;
}

/**
 * Bklit Ring Chart — Built on Visx (@visx/shape, @visx/group) and Framer Motion.
 * Displays network service availability distribution for mission-critical infrastructure.
 */
export const RingChart: React.FC<RingChartProps> = ({
  data,
  size = 200,
  strokeWidth = 14,
  centerLabel,
  centerSublabel,
  className,
  showLegend = true,
}) => {
  const total = useMemo(() => data.reduce((acc, curr) => acc + curr.value, 0), [data]);
  const center = size / 2;
  const outerRadius = (size - 16) / 2;
  const innerRadius = Math.max(0, outerRadius - strokeWidth);

  // Compute angles for each segment based on proportional values
  const arcs = useMemo(() => {
    if (total === 0) return [];
    let currentAngle = -Math.PI / 2; // Start at 12 o'clock
    const fullCircle = 2 * Math.PI;

    return data.map((d) => {
      const sliceAngle = (d.value / total) * fullCircle;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle = endAngle;

      const generator = arcGenerator<unknown>({
        innerRadius,
        outerRadius,
        cornerRadius: 4,
        padAngle: data.filter((item) => item.value > 0).length > 1 ? 0.03 : 0,
      });

      const path = generator({ startAngle, endAngle } as unknown as null) || "";

      return {
        ...d,
        startAngle,
        endAngle,
        path,
        percentage: ((d.value / total) * 100).toFixed(0),
      };
    });
  }, [data, total, innerRadius, outerRadius]);

  const fallbackPath = useMemo(() => {
    const generator = arcGenerator<unknown>({
      innerRadius,
      outerRadius,
      cornerRadius: 0,
    });
    return generator({ startAngle: 0, endAngle: 2 * Math.PI } as unknown as null) || "";
  }, [innerRadius, outerRadius]);

  return (
    <div className={cn("flex flex-col items-center justify-center select-none", className)}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="overflow-visible"
          aria-label="Graphique Bklit de disponibilité réseau"
        >
          <Group left={center} top={center}>
            {/* Background subtle track */}
            <path d={fallbackPath} className="fill-muted/30 dark:fill-muted/20" />

            {total > 0 &&
              arcs.map((arc, idx) => {
                if (!arc.path || arc.value <= 0) return null;
                return (
                  <motion.path
                    key={arc.label}
                    d={arc.path}
                    fill={arc.color}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: idx * 0.1, ease: "easeOut" }}
                    className="transition-opacity hover:opacity-85 cursor-pointer"
                  />
                );
              })}
          </Group>
        </svg>

        {/* Center Metrics Overlay */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4"
          style={{ width: size, height: size }}
        >
          {centerLabel ? (
            <>
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-2xl font-bold font-sans tracking-tight text-foreground"
              >
                {centerLabel}
              </motion.span>
              {centerSublabel && (
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5 max-w-[110px] truncate">
                  {centerSublabel}
                </span>
              )}
            </>
          ) : total === 0 ? (
            <>
              <span className="text-xl font-bold text-muted-foreground/60">—</span>
              <span className="text-[11px] text-muted-foreground/60 mt-0.5">Aucun équipement</span>
            </>
          ) : null}
        </div>
      </div>

      {/* Legend */}
      {showLegend && total > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-3 text-xs">
          {data.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 font-medium">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-muted-foreground">{item.label}</span>
              <span className="text-foreground font-semibold">({item.value})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RingChart;
