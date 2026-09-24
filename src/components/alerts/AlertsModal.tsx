import React, { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCheck,
  RefreshCw,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import * as alertService from "@/services/tauri/alerts";
import type { AlertDto } from "@/types/alert";
import { Dialog, Button, Badge } from "@/components/ui";

interface AlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAlertsChanged?: () => void;
}

export const AlertsModal: React.FC<AlertsModalProps> = ({
  isOpen,
  onClose,
  onAlertsChanged,
}) => {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState<AlertDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unresolvedOnly, setUnresolvedOnly] = useState(false);

  const fetchAlerts = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await alertService.getAlerts(token, unresolvedOnly, 50);
      setAlerts(data);
    } catch (err) {
      console.error("Failed to load alerts:", err);
    } finally {
      setIsLoading(false);
    }
  }, [token, unresolvedOnly]);

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen, fetchAlerts]);

  const handleMarkAsRead = async (id: number) => {
    if (!token) return;
    try {
      await alertService.markAlertAsRead(token, id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_read: true } : a))
      );
      onAlertsChanged?.();
    } catch (err) {
      console.error("Failed to mark alert as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!token) return;
    try {
      await alertService.markAllAlertsAsRead(token);
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
      onAlertsChanged?.();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleMarkAsResolved = async (id: number) => {
    if (!token) return;
    try {
      await alertService.markAlertAsResolved(token, id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_resolved: true } : a))
      );
      onAlertsChanged?.();
    } catch (err) {
      console.error("Failed to mark alert as resolved:", err);
    }
  };

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case "critical":
        return <AlertOctagon className="h-4 w-4 text-rose-500 shrink-0" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
      default:
        return <Info className="h-4 w-4 text-sky-500 shrink-0" />;
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "critical":
        return (
          <Badge variant="destructive" className="text-[10px] uppercase font-bold">
            Critique
          </Badge>
        );
      case "warning":
        return (
          <Badge variant="warning" className="text-[10px] uppercase font-bold">
            Avertissement
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[10px] uppercase">
            Info
          </Badge>
        );
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Centre d'Alertes Réseau ASECNA"
      description="Historique des incidents, pertes de paquets et dégradations de service"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Controls bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUnresolvedOnly(false)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                !unresolvedOnly
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Toutes
            </button>
            <button
              type="button"
              onClick={() => setUnresolvedOnly(true)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                unresolvedOnly
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Non résolues
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-7 text-xs gap-1"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Tout marquer lu</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchAlerts}
              className="h-7 w-7 p-0"
              title="Rafraîchir"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Alerts list */}
        <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
          {isLoading && alerts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center italic">
              Chargement des alertes...
            </p>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-xs text-muted-foreground">
                Aucune alerte enregistrée sur le réseau.
              </p>
            </div>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                className={`p-3 rounded-lg border text-xs transition-colors flex items-start justify-between gap-3 ${
                  !a.is_read
                    ? "bg-primary/5 border-primary/30"
                    : "bg-card border-border/70"
                }`}
              >
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <div className="mt-0.5">{getSeverityIcon(a.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {getSeverityBadge(a.severity)}
                      {a.device_name && (
                        <span className="font-semibold text-foreground">
                          {a.device_name}
                        </span>
                      )}
                      {a.device_ip && (
                        <span className="text-[11px] font-mono text-muted-foreground">
                          ({a.device_ip})
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                        {new Date(a.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-foreground leading-relaxed">{a.message}</p>
                    <div className="mt-2 flex items-center gap-2">
                      {a.is_resolved ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                          <CheckCircle2 className="h-3 w-3" />
                          Résolu
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsResolved(a.id)}
                          className="h-6 px-2 text-[10px]"
                        >
                          Marquer résolu
                        </Button>
                      )}
                      {!a.is_read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsRead(a.id)}
                          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Marquer lu
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Dialog>
  );
};
