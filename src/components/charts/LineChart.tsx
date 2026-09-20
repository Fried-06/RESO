import React, { useMemo, useState, useRef } from "react";
import { scaleLinear } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface DataPoint {
  time: string;
  value: number;
}

export interface LineChartProps {
  data: DataPoint[];
  height?: number;
  lineColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  unit?: string;
  emptyMessage?: string;
  className?: string;
}

interface ChartSvgProps {
  data: DataPoint[];
  width: number;
  height: number;
  lineColor: string;
  gradientFrom: string;
  gradientTo: string;
  unit: string;
}

const ChartSvg: React.FC<ChartSvgProps> = ({
  data,
  width,
  height,
  lineColor,
  gradientFrom,
  gradientTo,
  unit,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const margin = { top: 20, right: 20, bottom: 28, left: 40 };

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const values = useMemo(() => data.map((d) => d.value), [data]);
  const minValue = 0;
  const maxValue = useMemo(() => Math.max(10, Math.ceil(Math.max(...values, 10) * 1.15)), [values]);

  const xScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, Math.max(1, data.length - 1)],
        range: [0, innerWidth],
      }),
    [data.length, innerWidth]
  );

  const yScale = useMemo(
    () =>
      scaleLinear({
        domain: [minValue, maxValue],
        range: [innerHeight, 0],
        nice: true,
      }),
    [minValue, maxValue, innerHeight]
  );

  const getX = (_: DataPoint, i: number) => xScale(i);
  const getY = (d: DataPoint) => yScale(d.value);

  // Y-axis tick marks
  const yTicks = useMemo(() => {
    return [0, Math.round(maxValue / 2), maxValue];
  }, [maxValue]);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    const pointerX = e.clientX - svgRect.left - margin.left;
    if (pointerX < 0 || pointerX > innerWidth || data.length === 0) {
      setHoverIndex(null);
      return;
    }

    const ratio = pointerX / innerWidth;
    const closestIdx = Math.round(ratio * (data.length - 1));
    setHoverIndex(Math.max(0, Math.min(data.length - 1, closestIdx)));
  };

  const handlePointerLeave = () => setHoverIndex(null);

  const hoveredPoint = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div className="relative select-none" style={{ width, height }}>
      <svg
        width={width}
        height={height}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="cursor-crosshair overflow-visible"
      >
        <defs>
          <linearGradient id="bklit-line-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradientFrom} />
            <stop offset="100%" stopColor={gradientTo} />
          </linearGradient>
        </defs>

        <Group left={margin.left} top={margin.top}>
          {/* Subtle horizontal grid lines */}
          {yTicks.map((tick) => {
            const yPos = yScale(tick);
            return (
              <g key={tick}>
                <line
                  x1={0}
                  x2={innerWidth}
                  y1={yPos}
                  y2={yPos}
                  stroke="currentColor"
                  strokeDasharray="3 3"
                  className="text-border/40"
                />
                <text
                  x={-8}
                  y={yPos + 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px] font-mono"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Fill Area with Gradient */}
          <AreaClosed<DataPoint>
            data={data}
            x={getX}
            y={getY}
            yScale={yScale}
            curve={curveMonotoneX}
            fill="url(#bklit-line-gradient)"
          />

          {/* Stroke Line */}
          <LinePath<DataPoint>
            data={data}
            x={getX}
            y={getY}
            curve={curveMonotoneX}
            stroke={lineColor}
            strokeWidth={2}
            strokeLinecap="round"
          />

          {/* Interactive Crosshair & Tooltip */}
          {hoveredPoint && hoverIndex !== null && (
            <g>
              <line
                x1={xScale(hoverIndex)}
                x2={xScale(hoverIndex)}
                y1={0}
                y2={innerHeight}
                stroke={lineColor}
                strokeWidth={1}
                strokeDasharray="2 2"
                className="opacity-70"
              />
              <circle
                cx={xScale(hoverIndex)}
                cy={yScale(hoveredPoint.value)}
                r={4}
                fill={lineColor}
                stroke="var(--background)"
                strokeWidth={2}
                className="shadow-sm"
              />
            </g>
          )}

          {/* Time Labels on X axis */}
          {data.length > 0 && (
            <g transform={`translate(0, ${innerHeight + 16})`}>
              <text x={0} y={0} textAnchor="start" className="fill-muted-foreground text-[10px] font-mono">
                {data[0].time}
              </text>
              {data.length > 1 && (
                <text
                  x={innerWidth}
                  y={0}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px] font-mono"
                >
                  {data[data.length - 1].time}
                </text>
              )}
            </g>
          )}
        </Group>
      </svg>

      {/* Hover Floating Tooltip */}
      {hoveredPoint && hoverIndex !== null && (
        <motion.div
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute pointer-events-none rounded-md bg-popover/90 dark:bg-card/95 backdrop-blur-md border border-border px-2.5 py-1 text-xs shadow-md z-10"
          style={{
            left: Math.min(Math.max(margin.left, margin.left + xScale(hoverIndex) - 40), width - 90),
            top: Math.max(4, margin.top + yScale(hoveredPoint.value) - 36),
          }}
        >
          <div className="font-semibold text-foreground font-mono">
            {hoveredPoint.value.toFixed(1)} {unit}
          </div>
          <div className="text-[10px] text-muted-foreground">{hoveredPoint.time}</div>
        </motion.div>
      )}
    </div>
  );
};

/**
 * Bklit Line Chart — Composable time-series visualization built on Visx.
 * Monitored RTT latency graph for ASECNA civil aviation telemetry.
 */
export const LineChart: React.FC<LineChartProps> = ({
  data,
  height = 190,
  lineColor = "var(--chart-line-primary, #0284c7)",
  gradientFrom = "rgba(2, 132, 199, 0.22)",
  gradientTo = "rgba(2, 132, 199, 0.0)",
  unit = "ms",
  emptyMessage = "Aucun historique de télémétrie disponible",
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center border border-dashed border-border/70 rounded-xl bg-muted/10 p-6 text-center text-muted-foreground text-xs",
          className
        )}
        style={{ height }}
      >
        <span className="font-medium text-foreground/80 mb-1">Données insuffisantes</span>
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("w-full relative overflow-hidden", className)} style={{ height }}>
      <ParentSize debounceTime={10}>
        {({ width }) =>
          width > 20 ? (
            <ChartSvg
              data={data}
              width={width}
              height={height}
              lineColor={lineColor}
              gradientFrom={gradientFrom}
              gradientTo={gradientTo}
              unit={unit}
            />
          ) : null
        }
      </ParentSize>
    </div>
  );
};

export default LineChart;
