import React from "react";
import { Header } from "./Header";
import { Dock, NavTab } from "./Dock";

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
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-6 pb-28">
        {children}
      </main>
      <Dock activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
};
