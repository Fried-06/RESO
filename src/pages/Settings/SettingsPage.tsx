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
  Users,
  Trash2,
  Plus,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import * as settingsService from "@/services/tauri/settings";
import * as authService from "@/services/tauri/auth";
import * as usersService from "@/services/tauri/users";
import type { SettingsDto, UpdateSettingsRequest } from "@/types";
import type { UserDtoFull, UserRole } from "@/types/user";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Skeleton,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
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

  // User Administration (RBAC) state
  const [usersList, setUsersList] = useState<UserDtoFull[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("operator");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [userActionSuccess, setUserActionSuccess] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    if (!token || user?.role !== "admin") return;
    setIsLoadingUsers(true);
    setUsersError(null);
    try {
      const data = await usersService.getUsers(token);
      setUsersList(data);
    } catch (err: unknown) {
      console.error("Failed to load users:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setUsersError(msg || "Impossible de charger la liste des utilisateurs.");
    } finally {
      setIsLoadingUsers(false);
    }
  }, [token, user?.role]);

  useEffect(() => {
    if (user?.role === "admin") {
      loadUsers();
    }
  }, [user?.role, loadUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsCreatingUser(true);
    setUserActionError(null);
    setUserActionSuccess(null);
    try {
      await usersService.adminCreateUser(token, {
        username: newUsername.trim(),
        password: newUserPassword,
        role: newUserRole,
      });
      setUserActionSuccess(`Utilisateur ${newUsername} créé avec succès.`);
      setNewUsername("");
      setNewUserPassword("");
      setNewUserRole("operator");
      setIsAddUserModalOpen(false);
      await loadUsers();
      setTimeout(() => setUserActionSuccess(null), 4000);
    } catch (err: unknown) {
      console.error("Failed to create user:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setUserActionError(msg || "Échec de création de l'utilisateur.");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = async (targetUser: UserDtoFull) => {
    if (!token) return;
    if (targetUser.id === user?.id) {
      setUserActionError("Impossible de supprimer votre propre compte.");
      return;
    }
    const confirmed = window.confirm(
      `Confirmez-vous la suppression définitive du compte « ${targetUser.username} » ?`
    );
    if (!confirmed) return;

    setUserActionError(null);
    try {
      await usersService.adminDeleteUser(token, targetUser.id);
      setUserActionSuccess(`Compte ${targetUser.username} supprimé.`);
      await loadUsers();
      setTimeout(() => setUserActionSuccess(null), 4000);
    } catch (err: unknown) {
      console.error("Failed to delete user:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setUserActionError(msg || "Échec de suppression de l'utilisateur.");
    }
  };


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

      {/* User Administration (RBAC) - Strictly visible to Admin */}
      {user?.role === "admin" && (
        <Card className="border-border">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Gestion des Utilisateurs & Contrôle d'Accès (RBAC)
              </CardTitle>
              <CardDescription>
                Comptes opérateurs et administrateurs autorisés sur le poste ASECNA
              </CardDescription>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddUserModalOpen(true)}
              className="gap-1.5 self-start sm:self-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nouvel Utilisateur</span>
            </Button>
          </CardHeader>
          <CardContent>
            {userActionSuccess && (
              <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{userActionSuccess}</span>
              </div>
            )}
            {userActionError && (
              <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{userActionError}</span>
              </div>
            )}
            {usersError && (
              <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{usersError}</span>
              </div>
            )}

            {isLoadingUsers ? (
              <div className="space-y-2 py-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : usersList.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 italic">
                Aucun compte utilisateur trouvé.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Identifiant</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date Création</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersList.map((u) => {
                    const isSelf = u.id === user?.id;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-semibold text-foreground flex items-center gap-2">
                          <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{u.username}</span>
                          {isSelf && (
                            <span className="text-[10px] text-primary font-normal bg-primary/10 px-1.5 py-0.5 rounded">
                              (Vous)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={u.role === "admin" ? "default" : "secondary"}
                            className="text-[10px] uppercase font-bold"
                          >
                            {u.role === "admin" ? "Administrateur" : "Opérateur"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs ${
                              u.is_active ? "text-emerald-600 font-medium" : "text-muted-foreground"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                u.is_active ? "bg-emerald-500" : "bg-muted-foreground"
                              }`}
                            />
                            {u.is_active ? "Actif" : "Inactif"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isSelf}
                            onClick={() => handleDeleteUser(u)}
                            className="h-7 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                            title={isSelf ? "Impossible de supprimer votre propre compte" : "Supprimer"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add User Modal */}
      <Dialog
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        title="Créer un nouveau compte utilisateur"
        description="Définit les identifiants et le niveau d'habilitation RBAC de l'opérateur"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Nom d'utilisateur (Login)
            </label>
            <Input
              type="text"
              placeholder="ex: op_tour_controle"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Mot de passe initial
            </label>
            <Input
              type="password"
              placeholder="Minimum 8 caractères"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Niveau de privilèges (Rôle)
            </label>
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as UserRole)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="operator">Opérateur (Supervision & Sondes)</option>
              <option value="admin">Administrateur (Contrôle complet & RBAC)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddUserModalOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isCreatingUser}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Créer le compte
            </Button>
          </div>
        </form>
      </Dialog>

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

