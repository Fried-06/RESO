import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import * as discoveryService from "@/services/tauri/discovery";
import * as deviceService from "@/services/tauri/devices";
import type { DiscoveredDevice, DiscoveryProgress, StartDiscoveryRequest } from "@/types/discovery";
import type { CreateDeviceRequest } from "@/types/device";
import { formatTauriError } from "@/services/tauri/client";
import {
  Radar,
  Play,
  Square,
  Plus,
  CheckCircle2,
  Wifi,
  WifiOff,
  Clock,
  MonitorSmartphone,
  Hash,
} from "lucide-react";

/**
 * DiscoveryPage — Network discovery scan for the ASECNA 10.28.0.0/16 subnet.
 * Polls the backend for progress and discovered devices, supports stop/resume,
 * and allows adding discovered IPs directly to the device inventory.
 */
export const DiscoveryPage: React.FC = () => {
  const { token } = useAuth();
  const [progress, setProgress] = useState<DiscoveryProgress | null>(null);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [subnet, setSubnet] = useState("10.28.0.0/24");
  const [concurrency, setConcurrency] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [addingIp, setAddingIp] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRunning = progress?.is_running ?? false;

  // Poll discovery status
  const pollStatus = useCallback(async () => {
    if (!token) return;
    try {
      const [prog, devs] = await discoveryService.getDiscoveryStatus(token);
      setProgress(prog);
      setDevices(devs);
      if (prog.error) setError(prog.error);
    } catch {
      // silent poll errors
    }
  }, [token]);

  // Start polling when scan is running
  useEffect(() => {
    if (isRunning) {
      pollRef.current = setInterval(pollStatus, 800);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isRunning, pollStatus]);

  // Initial status check
  useEffect(() => {
    pollStatus();
  }, [pollStatus]);

  const handleStart = async () => {
    if (!token) return;
    setError(null);
    setAddSuccess(new Set());
    try {
      const req: StartDiscoveryRequest = {
        subnet: subnet || undefined,
        max_concurrency: concurrency,
        timeout_ms: 2000,
      };
      await discoveryService.startDiscovery(token, req);
      // Immediately start polling
      await pollStatus();
    } catch (err) {
      setError(formatTauriError(err));
    }
  };

  const handleStop = async () => {
    if (!token) return;
    try {
      await discoveryService.stopDiscovery(token);
      await pollStatus();
    } catch (err) {
      setError(formatTauriError(err));
    }
  };

  const handleAddDevice = async (dev: DiscoveredDevice) => {
    if (!token) return;
    setAddingIp(dev.ip_address);
    try {
      const req: CreateDeviceRequest = {
        name: dev.hostname || `Device-${dev.ip_address}`,
        ip_address: dev.ip_address,
        description: `Découvert automatiquement${dev.mac_address ? ` (MAC: ${dev.mac_address})` : ""}`,
        enabled: true,
        services: [],
      };
      await deviceService.createDevice(token, req);
      setAddSuccess((prev) => new Set(prev).add(dev.ip_address));
    } catch (err) {
      setError(formatTauriError(err));
    } finally {
      setAddingIp(null);
    }
  };

  const progressPct =
    progress && progress.total_targets > 0
      ? Math.round((progress.scanned_targets / progress.total_targets) * 100)
      : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-sky-500/15 flex items-center justify-center">
          <Radar className="w-5 h-5 text-primary dark:text-sky-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Découverte Réseau</h1>
          <p className="text-sm text-muted-foreground">
            Balayage du sous-réseau pour identifier les équipements actifs
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Sous-réseau cible
            </label>
            <input
              type="text"
              value={subnet}
              onChange={(e) => setSubnet(e.target.value)}
              disabled={isRunning}
              placeholder="10.28.0.0/24"
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 transition-all"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Concurrence
            </label>
            <input
              type="number"
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              disabled={isRunning}
              min={1}
              max={500}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 transition-all"
            />
          </div>
          <div>
            {!isRunning ? (
              <button
                onClick={handleStart}
                className="h-9 px-5 rounded-lg bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors active:scale-[0.97]"
              >
                <Play className="w-4 h-4" />
                Lancer la découverte
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="h-9 px-5 rounded-lg bg-destructive text-destructive-foreground font-medium text-sm flex items-center gap-2 hover:bg-destructive/90 transition-colors active:scale-[0.97]"
              >
                <Square className="w-4 h-4" />
                Arrêter
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {progress && (isRunning || progress.scanned_targets > 0) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                {isRunning && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
                {isRunning ? "Scan en cours" : "Scan terminé"} — {progress.subnet}
              </span>
              <span>
                {progress.scanned_targets.toLocaleString()} / {progress.total_targets.toLocaleString()} ({progressPct}%)
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                {progress.found_count} trouvé{progress.found_count > 1 ? "s" : ""}
              </span>
              {progress.current_ip && isRunning && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {progress.current_ip}
                </span>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Results table */}
      {devices.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Équipements détectés ({devices.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5" />
                      Adresse IP
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Hostname</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">MAC</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                    <div className="flex items-center justify-end gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      RTT
                    </div>
                  </th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">
                    <div className="flex items-center justify-center gap-1.5">
                      <MonitorSmartphone className="w-3.5 h-3.5" />
                      Statut
                    </div>
                  </th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((dev) => {
                  const isAdded = dev.is_registered || addSuccess.has(dev.ip_address);
                  const isAdding = addingIp === dev.ip_address;
                  return (
                    <tr
                      key={dev.ip_address}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono text-foreground">{dev.ip_address}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {dev.hostname || "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {dev.mac_address || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {dev.response_time_ms != null
                          ? `${dev.response_time_ms.toFixed(1)} ms`
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {isAdded ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {dev.registered_device_name || "Enregistré"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <WifiOff className="w-3.5 h-3.5" />
                            Non enregistré
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {!isAdded ? (
                          <button
                            onClick={() => handleAddDevice(dev)}
                            disabled={isAdding}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {isAdding ? "Ajout..." : "Ajouter"}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {devices.length === 0 && !isRunning && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Radar className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Aucun scan en cours</h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            Configurez un sous-réseau cible et lancez la découverte pour identifier les équipements actifs sur votre réseau ASECNA.
          </p>
        </div>
      )}
    </div>
  );
};

export default DiscoveryPage;
