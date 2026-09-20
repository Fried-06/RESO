import React, { useState, useEffect } from "react";
import { Plus, Trash2, Globe, Network } from "lucide-react";
import type {
  DeviceDto,
  CreateDeviceRequest,
  ServiceConfig,
  ServiceType,
} from "@/types";
import { Dialog, Button, Input } from "@/components/ui";

export interface DeviceFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (req: CreateDeviceRequest) => Promise<void>;
  initialDevice?: DeviceDto | null;
  isLoading?: boolean;
}

export const DeviceFormDialog: React.FC<DeviceFormDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialDevice,
  isLoading = false,
}) => {
  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [description, setDescription] = useState("");
  const [services, setServices] = useState<ServiceConfig[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialDevice) {
      setName(initialDevice.name);
      setIpAddress(initialDevice.ip_address);
      setDescription(initialDevice.description || "");
      setServices(
        initialDevice.services.map((s) => ({
          name: s.name,
          service_type: s.service_type,
          port: s.port,
          target: s.target,
        }))
      );
    } else {
      setName("");
      setIpAddress("");
      setDescription("");
      setServices([]);
    }
    setError(null);
  }, [initialDevice, isOpen]);

  const handleAddService = (type: ServiceType) => {
    if (type === "tcp") {
      setServices((prev) => [
        ...prev,
        {
          name: "Port TCP",
          service_type: "tcp",
          port: 80,
        },
      ]);
    } else {
      setServices((prev) => [
        ...prev,
        {
          name: "Point d'accès HTTP",
          service_type: type,
          port: type === "https" ? 443 : 80,
          target: `http://${ipAddress || "127.0.0.1"}`,
        },
      ]);
    }
  };

  const handleRemoveService = (index: number) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
  };

  const handleServiceChange = (index: number, updates: Partial<ServiceConfig>) => {
    setServices((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...updates } : s))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Le nom de l'équipement est requis.");
      return;
    }
    if (!ipAddress.trim()) {
      setError("L'adresse IP ou le nom d'hôte est requis.");
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        ip_address: ipAddress.trim(),
        description: description.trim() || undefined,
        enabled: true,
        services,
      });
      onClose();
    } catch (err: unknown) {
      console.error("Save device failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Impossible d'enregistrer l'équipement.");
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={initialDevice ? "Modifier l'équipement" : "Ajouter un équipement réseau"}
      description="Spécifiez les paramètres d'adressage et les services applicatifs L7 à sonder."
      maxWidth="lg"
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button variant="primary" type="button" onClick={handleSubmit} isLoading={isLoading}>
            {initialDevice ? "Enregistrer les modifications" : "Ajouter l'équipement"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Nom de l'équipement *
            </label>
            <Input
              type="text"
              placeholder="ex: ROU-DAK-01 ou VOR-ILS-SRV"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Adresse IP / Hôte *
            </label>
            <Input
              type="text"
              placeholder="ex: 192.168.1.1 ou amhs.asecna.int"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Description / Rôle opérationnel / Localisation
          </label>
          <Input
            type="text"
            placeholder="ex: Salle télécom bloc technique Dakar - Ligne principale"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* L7 Services Configuration */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Services Applicatifs L7 Associés
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Sondes de vérification applicative (Port TCP ou Endpoint HTTP/S)
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={() => handleAddService("tcp")}
              >
                <Plus className="h-3 w-3" />
                <span>+ Port TCP</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={() => handleAddService("http")}
              >
                <Plus className="h-3 w-3" />
                <span>+ HTTP</span>
              </Button>
            </div>
          </div>

          {services.length === 0 ? (
            <div className="p-4 rounded-lg border border-dashed border-border text-center bg-muted/10">
              <p className="text-xs text-muted-foreground">
                Aucun service applicatif configuré. Seule la sonde L3 (ICMP/Ping) sera exécutée.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {services.map((serv, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg border border-border bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center gap-2.5"
                >
                  <div className="flex items-center gap-1.5 shrink-0 text-xs font-semibold text-foreground">
                    {serv.service_type === "tcp" ? (
                      <Network className="h-4 w-4 text-primary" />
                    ) : (
                      <Globe className="h-4 w-4 text-accent" />
                    )}
                    <span className="uppercase">{serv.service_type}</span>
                  </div>

                  <input
                    type="text"
                    placeholder="Nom du service (ex: SSH, BDD)"
                    value={serv.name}
                    onChange={(e) => handleServiceChange(index, { name: e.target.value })}
                    className="h-8 rounded border border-input bg-background px-2 text-xs flex-1 w-full"
                    required
                  />

                  {serv.service_type === "tcp" ? (
                    <input
                      type="number"
                      placeholder="Port"
                      value={serv.port || ""}
                      onChange={(e) =>
                        handleServiceChange(index, { port: parseInt(e.target.value) || 0 })
                      }
                      className="h-8 rounded border border-input bg-background px-2 text-xs w-24"
                      min={1}
                      max={65535}
                      required
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder="https://..."
                      value={serv.target || ""}
                      onChange={(e) => handleServiceChange(index, { target: e.target.value })}
                      className="h-8 rounded border border-input bg-background px-2 text-xs flex-1 w-full"
                      required
                    />
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-rose-500 shrink-0"
                    onClick={() => handleRemoveService(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
    </Dialog>
  );
};
