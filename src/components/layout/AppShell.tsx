import React, { useState } from "react";
import { Header } from "./Header";
import { Dock, NavTab } from "./Dock";
import { AlertsModal } from "@/components/alerts/AlertsModal";

export interface AppShellProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onTabChange,
  children,
}) => {
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
      <Header onAlertClick={() => setIsAlertsOpen(true)} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-6 pb-28">
        {children}
      </main>
      <Dock activeTab={activeTab} onTabChange={onTabChange} />
      <AlertsModal
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
      />
    </div>
  );
};

