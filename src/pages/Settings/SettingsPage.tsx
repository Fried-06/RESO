import React, { useState, useEffect, useCallback } from "react";
import {
  Sliders,
  Sun,
  Moon,
  Lock,
  Database,
  CheckCircle2,
  AlertCircle,
  Save,
  Shield,
  Clock,
  Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import * as settingsService from "@/services/tauri/settings";
import * as authService from "@/services/tauri/auth";
import type { SettingsDto, UpdateSettingsRequest } from "@/types";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Skeleton,
} from "@/components/ui";

export const SettingsPage: React.FC = () => {
  const { token, user } = useAuth();
  const { theme, setTheme } = useTheme();

  // Engine Settings state
  const [settings, setSettings] = useState<SettingsDto | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState<string | null>(null);
  const [settingsErrorMsg, setSettingsErrorMsg] = useState<string | null>(null);

  // Form fields matching backend schema
  const [scanInterval, setScanInterval] = useState<number>(30);
  const [networkTimeout, setNetworkTimeout] = useState<number>(3000);
  const [maxConcurrency, setMaxConcurrency] = useState<number>(10);
  const [startupScan, setStartupScan] = useState<boolean>(true);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    setIsLoadingSettings(true);
    try {
      const data = await settingsService.getSettings(token);
      setSettings(data);
      setScanInterval(data.scan_interval_secs);
      setNetworkTimeout(data.network_timeout_ms);
      setMaxConcurrency(data.max_concurrent_tests);
      setStartupScan(data.startup_scan);
    } catch (err: unknown) {
      console.error("Failed to load settings:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setSettingsErrorMsg(msg || "Impossible de charger les paramètres du moteur.");
    } finally {
      setIsLoadingSettings(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSavingSettings(true);
    setSettingsSuccessMsg(null);
    setSettingsErrorMsg(null);

    const updatePayload: UpdateSettingsRequest = {
      scan_interval_secs: Number(scanInterval),
      network_timeout_ms: Number(networkTimeout),
      max_concurrent_tests: Number(maxConcurrency),
      startup_scan: startupScan,
    };

    try {
      const updated = await settingsService.updateSettings(token, updatePayload);
      setSettings(updated);
      setSettingsSuccessMsg("Configuration du moteur de supervision mise à jour avec succès.");
      setTimeout(() => setSettingsSuccessMsg(null), 4000);
    } catch (err: unknown) {
      console.error("Save settings failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setSettingsErrorMsg(msg || "Échec de la sauvegarde des paramètres.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setPasswordSuccessMsg(null);
    setPasswordErrorMsg(null);

    if (newPassword.length < 8) {
      setPasswordErrorMsg("Le nouveau mot de passe doit comporter au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordErrorMsg("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await authService.changePassword(token, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccessMsg("Mot de passe mis à jour avec succès.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setTimeout(() => setPasswordSuccessMsg(null), 4000);
    } catch (err: unknown) {
      console.error("Change password failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setPasswordErrorMsg(msg || "Échec de la mise à jour du mot de passe. Vérifiez l'ancien mot de passe.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoadingSettings) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header bar */}
      <div className="pb-4 border-b border-border">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
          Paramètres du Système
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
          Configuration des sondes réseau, préférences d'affichage et sécurité de l'opérateur
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engine Probes Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary" />
              Moteur de Supervision & Sondes
            </CardTitle>
            <CardDescription>
              Ajustez les fréquences d'échantillonnage et les délais limites de réponse
            </CardDescription>
          </CardHeader>
          <CardContent>
            {settingsSuccessMsg && (
              <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{settingsSuccessMsg}</span>
              </div>
            )}
            {settingsErrorMsg && (
              <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{settingsErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Intervalle de scan automatique (secondes)
                </label>
                <Input
                  type="number"
                  value={scanInterval}
                  onChange={(e) => setScanInterval(Number(e.target.value))}
                  min={5}
                  max={3600}
                  icon={<Clock className="h-4 w-4" />}
                  required
                />
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Fréquence d'exécution périodique des vérifications L3/L7 (recommandé: 15-60s).
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Timeout global des sondes (ms)
                </label>
                <Input
                  type="number"
                  value={networkTimeout}
                  onChange={(e) => setNetworkTimeout(Number(e.target.value))}
                  min={100}
                  max={30000}
                  required
                />
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Délai maximal d'attente pour ICMP Ping, TCP handshake et requêtes HTTP.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Concurrence maximale de vérification
                </label>
                <Input
                  type="number"
                  value={maxConcurrency}
                  onChange={(e) => setMaxConcurrency(Number(e.target.value))}
                  min={1}
                  max={100}
                  icon={<Zap className="h-4 w-4" />}
                  required
                />
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Nombre maximal de sondes asynchrones exécutées en parallèle.
                </span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="startupScan"
                  checked={startupScan}
                  onChange={(e) => setStartupScan(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="startupScan" className="text-xs text-foreground select-none cursor-pointer">
                  Exécuter un scan complet dès le démarrage du système
                </label>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSavingSettings}
                className="mt-2"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                <span>Enregistrer la configuration</span>
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Display & Security Column */}
        <div className="space-y-6">
          {/* Appearance card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sun className="h-4 w-4 text-accent" />
                Apparence & Thème d'Affichage
              </CardTitle>
              <CardDescription>
                Basculez entre le thème clair haute lisibilité et le thème sombre de salle de contrôle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                    theme === "light"
                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                      : "border-border hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <Sun className="h-4 w-4" />
                  <span>Mode Jour (Clair)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                    theme === "dark"
                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                      : "border-border hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <Moon className="h-4 w-4" />
                  <span>Mode Nuit (Sombre)</span>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Operator Security / Password Change */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Sécurité de l'Opérateur ({user?.username})
              </CardTitle>
              <CardDescription>
                Modification du mot de passe du compte opérateur en cours
              </CardDescription>
            </CardHeader>
            <CardContent>
              {passwordSuccessMsg && (
                <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{passwordSuccessMsg}</span>
                </div>
              )}
              {passwordErrorMsg && (
                <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{passwordErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Mot de passe actuel
                  </label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Nouveau mot de passe
                    </label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Confirmer nouveau
                    </label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  isLoading={isChangingPassword}
                  className="mt-2"
                >
                  <Shield className="h-3.5 w-3.5 mr-1.5" />
                  <span>Modifier mon mot de passe</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* System Information Card */}
      <Card className="border-border/60 bg-muted/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-foreground">
            <Database className="h-4 w-4 text-muted-foreground" />
            Informations Système ASECNA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground block">Application</span>
              <span className="font-semibold text-foreground">ASECNA Network Monitor</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Architecture</span>
              <span className="font-semibold text-foreground">Tauri 2 + Rust + React 19</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Moteur de Persistance</span>
              <span className="font-semibold text-foreground">SQLite WAL Embeded</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Dernière MàJ Paramètres</span>
              <span className="font-semibold text-foreground font-mono">
                {settings?.updated_at ? new Date(settings.updated_at).toLocaleDateString() : "Par défaut"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
