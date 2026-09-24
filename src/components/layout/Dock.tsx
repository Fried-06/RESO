import React from "react";
import {
  LayoutDashboard,
  Server,
  Activity,
  Radar,
  Sliders,
} from "lucide-react";
import { Dock as LightswindDock } from "@/components/lightswind/dock";
import { cn } from "@/lib/utils";

export type NavTab = "overview" | "devices" | "diagnostics" | "discovery" | "settings";

export interface DockProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

interface NavItemDef {
  id: NavTab;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItemDef[] = [
  { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: "devices", label: "Équipements", icon: Server },
  { id: "diagnostics", label: "Diagnostics", icon: Activity },
  { id: "discovery", label: "Découverte", icon: Radar },
  { id: "settings", label: "Paramètres", icon: Sliders },
];

/**
 * Main application navigation powered by official Lightswind Dock component.
 * Provides smooth spring magnification, tooltips, and tactile navigation for ASECNA Network Monitor.
 */
export const Dock: React.FC<DockProps> = ({ activeTab, onTabChange }) => {
  const dockItems = NAV_ITEMS.map((item) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;

    return {
      label: item.label,
      onClick: () => onTabChange(item.id),
      icon: (
        <div className="flex items-center justify-center relative w-full h-full">
          <Icon
            className={cn(
              "w-5 h-5 transition-colors duration-200",
              isActive ? "text-primary dark:text-sky-400 stroke-[2.5]" : "text-muted-foreground stroke-[1.75]"
            )}
          />
          {isActive && (
            <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-primary dark:bg-sky-400 shadow-sm" />
          )}
        </div>
      ),
      itemBackground: isActive
        ? "bg-primary/10 dark:bg-sky-500/15"
        : undefined,
      itemBorderColor: isActive
        ? "border-primary/30 dark:border-sky-400/40"
        : undefined,
    };
  });

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40">
      <LightswindDock
        items={dockItems}
        baseItemSize={44}
        magnification={58}
        panelHeight={56}
        distance={140}
        gap="gap-2.5"
        multiBorder={true}
        blurBackground={true}
      />
    </div>
  );
};

export default Dock;
