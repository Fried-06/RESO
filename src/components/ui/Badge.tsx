import React from "react";
import { Badge as LightswindBadge } from "@/components/lightswind/badge";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "operational"
  | "degraded"
  | "offline"
  | "unknown"
  | "layer"
  | "default"
  | "secondary"
  | "outline"
  | "accent"
  | "success"
  | "destructive"
  | "warning";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const statusClasses: Record<BadgeVariant, string> = {
  operational: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  degraded: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  offline: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
  unknown: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
  layer: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30 font-mono text-[10px]",
  default: "bg-primary/10 text-primary border-primary/30",
  secondary: "bg-secondary text-secondary-foreground border-border",
  outline: "border-border text-foreground bg-transparent",
  accent: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  destructive: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
};

const dotClasses: Record<BadgeVariant, string> = {
  operational: "bg-emerald-500",
  degraded: "bg-amber-500",
  offline: "bg-rose-500",
  unknown: "bg-slate-400",
  layer: "bg-sky-500",
  default: "bg-primary",
  secondary: "bg-secondary-foreground",
  outline: "bg-foreground",
  accent: "bg-amber-500",
  success: "bg-emerald-500",
  destructive: "bg-rose-500",
  warning: "bg-amber-500",
};

/**
 * Status Badge component powered by Lightswind with civil aviation status indicators.
 */
export const Badge: React.FC<BadgeProps> = ({
  variant = "default",
  dot = false,
  className,
  children,
  ...props
}) => {
  return (
    <LightswindBadge
      variant="unstyled"
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border select-none tracking-tight",
        statusClasses[variant] || statusClasses.default,
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            dotClasses[variant] || dotClasses.default
          )}
        />
      )}
      {children}
    </LightswindBadge>
  );
};

export default Badge;
