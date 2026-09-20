import React, { useState, useEffect, useCallback } from "react";
import {
  Zap,
  Globe,
  Network,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  History,
  ArrowRight,
  ShieldCheck,
  Radio,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import * as diagnosticService from "@/services/tauri/diagnostics";
import * as deviceService from "@/services/tauri/devices";
import type {
  DeviceDto,
  DiagnosticResult,
  DiagnosticHistoryRecord,
  PingResult,
  TcpTestResult,
  HttpTestResult,
  DeviceStatus,
} from "@/types";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  AccordionItem,
} from "@/components/ui";

export interface DiagnosticsPageProps {
  initialSelectedDevice?: DeviceDto | null;
}

export const DiagnosticsPage: React.FC<DiagnosticsPageProps> = ({
  initialSelectedDevice,
}) => {
  const { token } = useAuth();

  // Mode: "device" (comprehensive L3+L7) vs "adhoc" (direct ICMP/TCP/HTTP tool)
  const [activeTab, setActiveTab] = useState<"device" | "adhoc">("device");

  // Device diagnostic state
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | "">("");
  const [isRunningDeviceDiagnostic, setIsRunningDeviceDiagnostic] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [history, setHistory] = useState<DiagnosticHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Ad-hoc tests state
  const [adhocType, setAdhocType] = useState<"ping" | "tcp" | "http">("ping");
  const [adhocTarget, setAdhocTarget] = useState("127.0.0.1");
  const [adhocPort, setAdhocPort] = useState<number>(80);
  const [adhocUrl, setAdhocUrl] = useState("https://www.asecna.aero");
  const [isRunningAdhoc, setIsRunningAdhoc] = useState(false);
  const [adhocPingResult, setAdhocPingResult] = useState<PingResult | null>(null);
  const [adhocTcpResult, setAdhocTcpResult] = useState<TcpTestResult | null>(null);
  const [adhocHttpResult, setAdhocHttpResult] = useState<HttpTestResult | null>(null);
  const [adhocError, setAdhocError] = useState<string | null>(null);

  // Load devices list — selectedDeviceId intentionally excluded from deps
  // to avoid an infinite re-render loop (selecting first device → deps change → reload → repeat)
  const loadDevices = useCallback(async () => {
    if (!token) return;
    try {
      const list = await deviceService.getDevices(token);
      setDevices(list);
      if (initialSelectedDevice) {
        setSelectedDeviceId(initialSelectedDevice.id);
      } else if (list.length > 0) {
        setSelectedDeviceId((prev) => (prev === "" ? list[0].id : prev));
      }
    } catch (err) {
      console.error("Failed to load devices for diagnostics:", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, initialSelectedDevice]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // Load history when selected device changes
  const loadHistory = useCallback(async (devId: number) => {
    if (!token) return;
    setIsLoadingHistory(true);
    try {
      const records = await diagnosticService.getDeviceHistory(token, devId, 10);
      setHistory(records);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [token]);

  useEffect(() => {
    if (typeof selectedDeviceId === "number") {
      loadHistory(selectedDeviceId);
    } else {
      setHistory([]);
    }
  }, [selectedDeviceId, loadHistory]);

  // Run comprehensive diagnostic
  const handleRunDeviceDiagnostic = async () => {
    if (!token || typeof selectedDeviceId !== "number") return;
    setIsRunningDeviceDiagnostic(true);
    setDiagnosticError(null);
    setDiagnosticResult(null);
    try {
      const res = await diagnosticService.runDeviceDiagnostic(token, selectedDeviceId);
      setDiagnosticResult(res);
      await loadHistory(selectedDeviceId);
    } catch (err: unknown) {
      console.error("Diagnostic execution error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setDiagnosticError(msg || "Échec du diagnostic réseau. Vérifiez la console pour plus de détails.");
    } finally {
      setIsRunningDeviceDiagnostic(false);
    }
  };

  // Run Ad-hoc test
  const handleRunAdhocTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunningAdhoc(true);
    setAdhocError(null);
    try {
      if (adhocType === "ping") {
        const res = await diagnosticService.runPing(adhocTarget.trim());
        setAdhocPingResult(res);
      } else if (adhocType === "tcp") {
        const res = await diagnosticService.runTcpTest(adhocTarget.trim(), Number(adhocPort));
        setAdhocTcpResult(res);
      } else if (adhocType === "http") {
        const res = await diagnosticService.runHttpTest(adhocUrl.trim());
        setAdhocHttpResult(res);
      }
    } catch (err: unknown) {
      console.error("Adhoc test failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setAdhocError(msg || "Échec d'exécution du test réseau.");
    } finally {
      setIsRunningAdhoc(false);
    }
  };

  const renderStatusBadge = (status: string | DeviceStatus) => {
    const s = String(status).toLowerCase();
    switch (s) {
      case "operational":
      case "online":
        return (
          <Badge variant="success" className="gap-1.5 font-bold">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>OPÉRATIONNEL (L3/L7 OK)</span>
          </Badge>
        );
      case "degraded":
        return (
          <Badge variant="warning" className="gap-1.5 font-bold">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>SERVICES DÉGRADÉS</span>
          </Badge>
        );
      case "offline":
        return (
          <Badge variant="destructive" className="gap-1.5 font-bold">
            <XCircle className="h-3.5 w-3.5" />
            <span>HORS LIGNE (OFFLINE)</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1.5">
            <span>INCONNU</span>
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header with Mode switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            Diagnostics Réseau & Applicatif
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Analyse consolidée L3 (ICMP / RTT) et validation des services L7 (TCP / HTTP)
          </p>
        </div>

        {/* Sub-navigation pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border">
          <button
            type="button"
            onClick={() => setActiveTab("device")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "device"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Diagnostic Équipement L3/L7
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("adhoc")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "adhoc"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sondes Ad-hoc Rapides
          </button>
        </div>
      </div>

      {activeTab === "device" ? (
        /* Comprehensive Device Diagnostic View */
        <div className="space-y-6">
          {/* Target Selection & Trigger card */}
          <Card className="p-5 border-border">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex-1 max-w-md">
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Sélectionner un équipement à sonder
                </label>
                {devices.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Aucun équipement disponible. Veuillez en ajouter un dans l'onglet Équipements.
                  </p>
                ) : (
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => {
                      setSelectedDeviceId(Number(e.target.value));
                      setDiagnosticResult(null);
                    }}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} — {d.ip_address}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-end">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleRunDeviceDiagnostic}
                  isLoading={isRunningDeviceDiagnostic}
                  disabled={!selectedDeviceId || devices.length === 0}
                  className="w-full sm:w-auto"
                >
                  <Play className="h-4 w-4 mr-1.5 fill-current" />
                  <span>Lancer le diagnostic complet</span>
                </Button>
              </div>
            </div>
          </Card>

          {/* Visual Execution State Banner: Idle -> Running -> Success / Degraded / Failed */}
          {isRunningDeviceDiagnostic && (
            <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 text-sm flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                </span>
                <span className="font-semibold text-xs md:text-sm">
                  ● Diagnostic en cours... Sondage réseau L3 (ICMP) et vérification des services applicatifs L7
                </span>
              </div>
              <span className="text-[11px] font-mono opacity-80 hidden sm:inline">
                Patientez...
              </span>
            </div>
          )}

          {/* Diagnostic execution error banner */}
          {diagnosticError && (
            <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm flex items-start gap-2">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold block">Échec du diagnostic</span>
                <span className="text-xs font-mono">{diagnosticError}</span>
              </div>
            </div>
          )}

          {/* Diagnostic Result breakdown */}
          {diagnosticResult && (
            <div className="space-y-4 animate-in zoom-in-95 duration-200">
              {/* Overall status banner */}
              <div className="p-5 rounded-xl border border-border bg-card shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-medium text-muted-foreground">
                      Résultat consolidé pour
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {diagnosticResult.device_name}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">
                      ({diagnosticResult.ip_address})
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {renderStatusBadge(diagnosticResult.overall_status)}
                    <span className="text-xs text-muted-foreground">
                      Horodaté à {new Date(diagnosticResult.executed_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Latence L3 ICMP</div>
                  <div className="text-lg font-bold text-foreground font-mono">
                    {diagnosticResult.l3_result.latency_ms !== null && diagnosticResult.l3_result.latency_ms !== undefined
                      ? `${Math.round(diagnosticResult.l3_result.latency_ms * 10) / 10} ms`
                      : "Délai dépassé (Échec)"}
                  </div>
                </div>
              </div>

              {/* L3 vs L7 Accordion / Details */}
              <div className="space-y-3">
                {/* L3 Layer details */}
                <AccordionItem
                  defaultOpen={true}
                  icon={<Radio className="h-4 w-4 text-primary" />}
                  title="Couche L3 — Connectivité Réseau (ICMP/Ping)"
                  subtitle={`Cible: ${diagnosticResult.l3_result.target}`}
                  badge={
                    diagnosticResult.l3_result.success ? (
                      <Badge variant="success">SUCCÈS</Badge>
                    ) : (
                      <Badge variant="destructive">ÉCHEC</Badge>
                    )
                  }
                >
                  <div className="py-2 space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Protocole</span>
                      <span className="font-mono font-medium">ICMP Echo Request (WinPing API)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Statut Réseau</span>
                      <span className="font-semibold">
                        {diagnosticResult.l3_result.success ? "Accessible" : "Inaccessible"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Temps d'aller-retour (RTT)</span>
                      <span className="font-mono font-medium">
                        {diagnosticResult.l3_result.latency_ms !== null && diagnosticResult.l3_result.latency_ms !== undefined
                          ? `${diagnosticResult.l3_result.latency_ms} ms`
                          : "Non disponible"}
                      </span>
                    </div>
                    {diagnosticResult.l3_result.error && (
                      <div className="p-2 rounded bg-rose-500/10 text-rose-600 font-mono mt-1">
                        Erreur : {diagnosticResult.l3_result.error}
                      </div>
                    )}
                  </div>
                </AccordionItem>

                {/* L7 Layer details */}
                <AccordionItem
                  defaultOpen={true}
                  icon={<ShieldCheck className="h-4 w-4 text-accent" />}
                  title="Couche L7 — Disponibilité Applicative (TCP / HTTP)"
                  subtitle={`${diagnosticResult.l7_results.length} service(s) testé(s)`}
                  badge={
                    diagnosticResult.l7_results.length === 0 ? (
                      <Badge variant="outline">Aucun service L7</Badge>
                    ) : diagnosticResult.l7_results.every((s) => s.success) ? (
                      <Badge variant="success">L7 VALIDE</Badge>
                    ) : (
                      <Badge variant="warning">L7 ANOMALIE</Badge>
                    )
                  }
                >
                  {diagnosticResult.l7_results.length === 0 ? (
                    <p className="py-2 text-xs text-muted-foreground italic">
                      Aucun service applicatif TCP ou HTTP configuré sur cet équipement.
                    </p>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {diagnosticResult.l7_results.map((serv, i) => (
                        <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            {serv.service_type === "tcp" ? (
                              <Network className="h-4 w-4 text-primary" />
                            ) : (
                              <Globe className="h-4 w-4 text-accent" />
                            )}
                            <div>
                              <span className="font-semibold text-foreground">
                                {serv.name}
                              </span>
                              <span className="text-[11px] text-muted-foreground uppercase ml-2">
                                ({serv.service_type} : {serv.port})
                              </span>
                              {serv.error && (
                                <p className="text-[11px] text-rose-500 font-mono mt-0.5">
                                  {serv.error}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {serv.status_code && (
                              <Badge variant="outline" className="font-mono text-[10px]">
                                HTTP {serv.status_code}
                              </Badge>
                            )}
                            {serv.latency_ms !== null && serv.latency_ms !== undefined && (
                              <span className="font-mono text-muted-foreground text-[11px]">
                                {serv.latency_ms} ms
                              </span>
                            )}
                            {serv.success ? (
                              <Badge variant="success" className="text-[10px]">
                                OK
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">
                                ÉCHEC
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionItem>
              </div>
            </div>
          )}

          {/* Diagnostic History Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                Historique des Sondes (10 dernières vérifications)
              </CardTitle>
              <CardDescription>
                Évolution temporelle de la connectivité de l'équipement sélectionné
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="space-y-2">
                  <div className="h-8 bg-muted/40 animate-pulse rounded" />
                  <div className="h-8 bg-muted/40 animate-pulse rounded" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center italic">
                  Aucun historique enregistré pour cet équipement. Lancez un diagnostic pour enregistrer une première mesure.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Horodatage</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>L3 (ICMP)</TableHead>
                      <TableHead>L7 (Applicatif)</TableHead>
                      <TableHead className="text-right">Latence L3</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="text-xs font-mono">
                          {new Date(record.executed_at).toLocaleString()}
                        </TableCell>
                        <TableCell>{renderStatusBadge(record.overall_status)}</TableCell>
                        <TableCell>
                          {record.l3_success === 1 ? (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              Succès
                            </span>
                          ) : (
                            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                              Échec
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono text-muted-foreground">
                            {record.l7_summary || "N/A"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {record.l3_latency_ms !== null && record.l3_latency_ms !== undefined
                            ? `${record.l3_latency_ms} ms`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Ad-Hoc Direct Network Probes View */
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-accent" />
              <h3 className="text-base font-bold text-foreground">
                Sondes Ad-Hoc Immédiates
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mb-6">
              Exécutez des tests réseau instantanés sans nécessiter d'enregistrement préalable dans l'inventaire.
            </p>

            {/* Probe Type Tabs */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <button
                type="button"
                onClick={() => setAdhocType("ping")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                  adhocType === "ping"
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                    : "border-border hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <Radio className="h-5 w-5 mb-1.5" />
                <span>ICMP / Ping (L3)</span>
              </button>

              <button
                type="button"
                onClick={() => setAdhocType("tcp")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                  adhocType === "tcp"
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                    : "border-border hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <Network className="h-5 w-5 mb-1.5" />
                <span>Port TCP (L4/L7)</span>
              </button>

              <button
                type="button"
                onClick={() => setAdhocType("http")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                  adhocType === "http"
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                    : "border-border hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <Globe className="h-5 w-5 mb-1.5" />
                <span>Requête HTTP/S (L7)</span>
              </button>
            </div>

            {/* Form based on selected probe */}
            <form onSubmit={handleRunAdhocTest} className="space-y-4">
              {adhocType === "ping" && (
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Adresse IP cible ou Hôte DNS
                  </label>
                  <Input
                    type="text"
                    placeholder="ex: 127.0.0.1 ou dns.asecna.int"
                    value={adhocTarget}
                    onChange={(e) => setAdhocTarget(e.target.value)}
                    required
                  />
                </div>
              )}

              {adhocType === "tcp" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Hôte / IP
                    </label>
                    <Input
                      type="text"
                      placeholder="ex: 127.0.0.1"
                      value={adhocTarget}
                      onChange={(e) => setAdhocTarget(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Port TCP
                    </label>
                    <Input
                      type="number"
                      placeholder="ex: 80, 443, 22"
                      value={adhocPort}
                      onChange={(e) => setAdhocPort(Number(e.target.value))}
                      min={1}
                      max={65535}
                      required
                    />
                  </div>
                </div>
              )}

              {adhocType === "http" && (
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    URL HTTP ou HTTPS
                  </label>
                  <Input
                    type="url"
                    placeholder="https://services.asecna.int/health"
                    value={adhocUrl}
                    onChange={(e) => setAdhocUrl(e.target.value)}
                    required
                  />
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                isLoading={isRunningAdhoc}
                className="w-full sm:w-auto"
              >
                <span>Exécuter le test immédiat</span>
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </form>

            {adhocError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                {adhocError}
              </div>
            )}
          </Card>

          {/* Ad-hoc Result Render */}
          {adhocType === "ping" && adhocPingResult && (
            <Card className="p-5 border-border animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h4 className="text-sm font-bold text-foreground">Résultat Sonde ICMP</h4>
                {adhocPingResult.success ? (
                  <Badge variant="success">SUCCÈS</Badge>
                ) : (
                  <Badge variant="destructive">ÉCHEC</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Cible</span>
                  <span className="font-semibold text-foreground font-mono">
                    {adhocPingResult.target}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Temps d'aller-retour</span>
                  <span className="font-semibold text-foreground font-mono">
                    {adhocPingResult.latency_ms !== null && adhocPingResult.latency_ms !== undefined
                      ? `${adhocPingResult.latency_ms} ms`
                      : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Erreur éventuelle</span>
                  <span className="font-mono text-muted-foreground">
                    {adhocPingResult.error || "Aucune"}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {adhocType === "tcp" && adhocTcpResult && (
            <Card className="p-5 border-border animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h4 className="text-sm font-bold text-foreground">Résultat Sonde Port TCP</h4>
                {adhocTcpResult.success ? (
                  <Badge variant="success">PORT OUVERT</Badge>
                ) : (
                  <Badge variant="destructive">FERMÉ / INACCESSIBLE</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Cible : Port</span>
                  <span className="font-semibold text-foreground font-mono">
                    {adhocTcpResult.host}:{adhocTcpResult.port}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Latence connexion</span>
                  <span className="font-semibold text-foreground font-mono">
                    {adhocTcpResult.latency_ms !== null && adhocTcpResult.latency_ms !== undefined
                      ? `${adhocTcpResult.latency_ms} ms`
                      : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Message</span>
                  <span className="font-mono text-muted-foreground">
                    {adhocTcpResult.error || "Handshake TCP réussi"}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {adhocType === "http" && adhocHttpResult && (
            <Card className="p-5 border-border animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h4 className="text-sm font-bold text-foreground">Résultat Sonde Requête HTTP</h4>
                {adhocHttpResult.success ? (
                  <Badge variant="success">RÉPONSE REÇUE</Badge>
                ) : (
                  <Badge variant="destructive">ÉCHEC REQUÊTE</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">URL</span>
                  <span className="font-semibold text-foreground font-mono truncate block" title={adhocHttpResult.url}>
                    {adhocHttpResult.url}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Code HTTP retour</span>
                  <span className="font-semibold text-foreground font-mono">
                    {adhocHttpResult.status_code || "Aucun code (Timeout/Network)"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Temps de réponse</span>
                  <span className="font-semibold text-foreground font-mono">
                    {adhocHttpResult.latency_ms !== null && adhocHttpResult.latency_ms !== undefined
                      ? `${adhocHttpResult.latency_ms} ms`
                      : "N/A"}
                  </span>
                </div>
              </div>
              {adhocHttpResult.error && (
                <div className="mt-3 p-2 rounded bg-rose-500/10 text-rose-600 font-mono text-xs">
                  {adhocHttpResult.error}
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
