import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Server,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Activity,
  Network,
  Globe,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  SlidersHorizontal,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import * as deviceService from "@/services/tauri/devices";
import * as diagnosticService from "@/services/tauri/diagnostics";
import type { DeviceDto, CreateDeviceRequest, DeviceStatus } from "@/types";
import {
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  ExpandableSearchBar,
  Skeleton,
  Dialog,
} from "@/components/ui";
import { DeviceFormDialog } from "./DeviceFormDialog";

export interface DevicesPageProps {
  onDiagnoseDevice: (device: DeviceDto) => void;
  openAddModalInitially?: boolean;
  onCloseAddModal?: () => void;
}

export const DevicesPage: React.FC<DevicesPageProps> = ({
  onDiagnoseDevice,
  openAddModalInitially = false,
  onCloseAddModal,
}) => {
  const { token } = useAuth();
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [statusMap, setStatusMap] = useState<Record<number, DeviceStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(openAddModalInitially);
  const [editingDevice, setEditingDevice] = useState<DeviceDto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal state
  const [deviceToDelete, setDeviceToDelete] = useState<DeviceDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (openAddModalInitially) {
      setEditingDevice(null);
      setIsFormOpen(true);
      onCloseAddModal?.();
    }
  }, [openAddModalInitially, onCloseAddModal]);

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (!token) return;
    if (showRefreshing) setIsRefreshing(true);
    setError(null);
    try {
      const [deviceList, overview] = await Promise.all([
        deviceService.getDevices(token),
        diagnosticService.getNetworkOverview(token).catch(() => null),
      ]);

      setDevices(deviceList);

      if (overview && overview.results) {
        const mapping: Record<number, DeviceStatus> = {};
        for (const res of overview.results) {
          mapping[res.device_id] = res.overall_status;
        }
        setStatusMap(mapping);
      }
    } catch (err: unknown) {
      console.error("Failed to load devices:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Erreur de chargement des équipements.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle create or update
  const handleSaveDevice = async (req: CreateDeviceRequest) => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      if (editingDevice) {
        await deviceService.updateDevice(token, editingDevice.id, req);
      } else {
        await deviceService.createDevice(token, req);
      }
      await fetchData();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleConfirmDelete = async () => {
    if (!token || !deviceToDelete) return;
    setIsDeleting(true);
    try {
      await deviceService.deleteDevice(token, deviceToDelete.id);
      setDeviceToDelete(null);
      await fetchData();
    } catch (err) {
      console.error("Delete device failed:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered devices list
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.ip_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const currentStatus = statusMap[d.id] || "unknown";
      const matchesStatus = statusFilter === "all" || currentStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [devices, searchQuery, statusFilter, statusMap]);

  const renderStatusBadge = (status?: DeviceStatus) => {
    switch (status) {
      case "operational":
        return (
          <Badge variant="success" className="gap-1.5">
            <CheckCircle2 className="h-3 w-3" />
            <span>Opérationnel</span>
          </Badge>
        );
      case "degraded":
        return (
          <Badge variant="warning" className="gap-1.5">
            <AlertTriangle className="h-3 w-3" />
            <span>Dégradé</span>
          </Badge>
        );
      case "offline":
        return (
          <Badge variant="destructive" className="gap-1.5">
            <XCircle className="h-3 w-3" />
            <span>Hors ligne</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1.5">
            <HelpCircle className="h-3 w-3 text-muted-foreground" />
            <span>En attente / Inconnu</span>
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            Parc des Équipements
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Inventaire opérationnel, adressage IP et services L7 surveillés
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            isLoading={isRefreshing}
            className="text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Actualiser
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingDevice(null);
              setIsFormOpen(true);
            }}
            className="text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Ajouter un équipement
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
          {error}
        </div>
      )}

      {/* Control bar: Search + Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card/60">
        <ExpandableSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Filtrer par nom, IP, description..."
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground hidden lg:inline">Statut:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Tous les statuts</option>
            <option value="operational">Opérationnel</option>
            <option value="degraded">Dégradé</option>
            <option value="offline">Hors ligne</option>
            <option value="unknown">En attente / Inconnu</option>
          </select>
        </div>
      </div>

      {/* Devices Table / Empty state */}
      {devices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
            <Server className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">Aucun équipement dans la base</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1.5 leading-relaxed">
            Commencez par ajouter votre premier nœud d'infrastructure pour activer la surveillance L3/L7.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingDevice(null);
              setIsFormOpen(true);
            }}
            className="mt-4"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Ajouter un équipement
          </Button>
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-xs text-muted-foreground">
            Aucun équipement ne correspond aux critères de recherche actuels.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Équipement</TableHead>
              <TableHead>Statut Opérationnel</TableHead>
              <TableHead>Services L7 Associés</TableHead>
              <TableHead>Enregistré le</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDevices.map((device) => (
              <TableRow key={device.id} className="group">
                {/* Device Info */}
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground text-sm">
                      {device.name}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono mt-0.5">
                      {device.ip_address}
                    </span>
                    {device.description && (
                      <span className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {device.description}
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* Status */}
                <TableCell>{renderStatusBadge(statusMap[device.id])}</TableCell>

                {/* Services */}
                <TableCell>
                  {device.services.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">L3 seul (ICMP)</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {device.services.map((s, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-muted/60 border border-border text-foreground"
                          title={s.service_type === "tcp" ? `Port TCP ${s.port}` : `${s.service_type.toUpperCase()} ${s.target || ""}`}
                        >
                          {s.service_type === "tcp" ? (
                            <Network className="h-3 w-3 text-primary" />
                          ) : (
                            <Globe className="h-3 w-3 text-accent" />
                          )}
                          <span>
                            {s.service_type === "tcp" ? `:${s.port}` : s.name}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </TableCell>

                {/* Date */}
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                  {new Date(device.created_at).toLocaleDateString()}
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onDiagnoseDevice(device)}
                      className="h-7 text-xs px-2.5 gap-1"
                      title="Exécuter diagnostic L3/L7"
                    >
                      <Activity className="h-3.5 w-3.5" />
                      <span>Diagnostiquer</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingDevice(device);
                        setIsFormOpen(true);
                      }}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Modifier"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeviceToDelete(device)}
                      className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add / Edit Dialog */}
      <DeviceFormDialog
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingDevice(null);
        }}
        onSubmit={handleSaveDevice}
        initialDevice={editingDevice}
        isLoading={isSubmitting}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={!!deviceToDelete}
        onClose={() => setDeviceToDelete(null)}
        title="Confirmer la suppression"
        description="Cette action retirera définitivement cet équipement de la supervision ainsi que tout son historique diagnostique associé."
        maxWidth="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeviceToDelete(null)}
              disabled={isDeleting}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              isLoading={isDeleting}
            >
              Supprimer
            </Button>
          </>
        }
      >
        <p className="text-xs text-foreground font-semibold">
          Équipement ciblé :{" "}
          <span className="text-rose-600 dark:text-rose-400">
            {deviceToDelete?.name} ({deviceToDelete?.ip_address})
          </span>
        </p>
      </Dialog>
    </div>
  );
};
