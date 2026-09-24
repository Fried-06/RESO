import React, { useState } from "react";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppShell, NavTab } from "@/components/layout";
import { AuthPage } from "@/pages/Auth/AuthPage";
import { OverviewPage } from "@/pages/Overview/OverviewPage";
import { DevicesPage } from "@/pages/Devices/DevicesPage";
import { DiagnosticsPage } from "@/pages/Diagnostics/DiagnosticsPage";
import { DiscoveryPage } from "@/pages/Discovery/DiscoveryPage";
import { SettingsPage } from "@/pages/Settings/SettingsPage";
import type { DeviceDto } from "@/types";
import logoAsecna from "@/assets/Logo_ASECNA.png";

const MainContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>("overview");
  const [selectedDeviceForDiagnostic, setSelectedDeviceForDiagnostic] = useState<DeviceDto | null>(null);
  const [openAddDeviceModal, setOpenAddDeviceModal] = useState(false);

  // Splash loading screen while checking auth and SQLite status
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground select-none">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
          <img
            src={logoAsecna}
            alt="ASECNA"
            className="h-16 w-auto object-contain animate-pulse"
          />
          <div className="flex flex-col items-center text-center">
            <h2 className="text-base font-bold tracking-wider uppercase text-foreground">
              ASECNA Network Monitor
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Connexion au moteur de supervision et vérification SQLite...
            </p>
          </div>
          <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden mt-2">
            <div className="h-full bg-primary rounded-full animate-[progress_1.5s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>
    );
  }

  // If user is not authenticated or bootstrap is required, render AuthPage
  if (!user) {
    return <AuthPage />;
  }

  const handleDiagnoseDevice = (device: DeviceDto) => {
    setSelectedDeviceForDiagnostic(device);
    setActiveTab("diagnostics");
  };

  const handleOpenAddDevice = () => {
    setOpenAddDeviceModal(true);
    setActiveTab("devices");
  };

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "overview" && (
        <OverviewPage
          onNavigate={(tab) => setActiveTab(tab)}
          onOpenAddDevice={handleOpenAddDevice}
        />
      )}

      {activeTab === "devices" && (
        <DevicesPage
          onDiagnoseDevice={handleDiagnoseDevice}
          openAddModalInitially={openAddDeviceModal}
          onCloseAddModal={() => setOpenAddDeviceModal(false)}
        />
      )}

      {activeTab === "diagnostics" && (
        <DiagnosticsPage initialSelectedDevice={selectedDeviceForDiagnostic} />
      )}

      {activeTab === "discovery" && <DiscoveryPage />}

      {activeTab === "settings" && <SettingsPage />}
    </AppShell>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
