import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Activity,
  Server,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  Radio,
  Clock,
  Wifi,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import * as diagnosticService from "@/services/tauri/diagnostics";
import type { NetworkOverview, DiagnosticResult } from "@/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Skeleton,
} from "@/components/ui";
import { RingChart, LineChart } from "@/components/charts";
import type { NavTab } from "@/components/layout";

export interface OverviewPageProps {
  onNavigate: (tab: NavTab) => void;
  onOpenAddDevice: () => void;
}

/**
 * ASECNA Network Monitor — Operational Overview (V2).
 * Answers immediately: "What is the operational status of the critical network under surveillance?"
 * Uses exclusively real backend data with Bklit Ring & Line charts. Zero mock data.
 */
export const OverviewPage: React.FC<OverviewPageProps> = ({
  onNavigate,
  onOpenAddDevice,
}) => {
  const { token } = useAuth();
  const [overview, setOverview] = useState<NetworkOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchOverview = useCallback(
    async (showRefreshingSpinner = false) => {
      if (!token) return;
      if (showRefreshingSpinner) setIsRefreshing(true);
      setError(null);
      try {
        const data = await diagnosticService.getNetworkOverview(token);
        setOverview(data);
        setLastUpdated(new Date());
      } catch (err: unknown) {
        console.error("Failed to load overview:", err);
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || "Impossible de récupérer les métriques de supervision réseau.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Derived metrics calculated strictly from real backend data
  const { availabilityRate, averageLatency, attentionRequired, ringData, realLatencyPoints } =
    useMemo(() => {
      if (!overview || overview.total_devices === 0) {
        return {
          availabilityRate: 100,
          averageLatency: null,
          attentionRequired: [] as DiagnosticResult[],
          ringData: [],
          realLatencyPoints: [],
        };
      }

      // Operational availability score
      const rate =
        Math.round(
          ((overview.online_devices + overview.degraded_devices * 0.5) /
            overview.total_devices) *
            1000
        ) / 10;

      // Extract real measured latencies from scan results
      const latencyEntries: { time: string; value: number }[] = [];
      const numericLatencies: number[] = [];

      for (const res of overview.results) {
        if (typeof res.l3_result.latency_ms === "number" && res.l3_result.latency_ms >= 0) {
          numericLatencies.push(res.l3_result.latency_ms);
          latencyEntries.push({
            time: res.device_name,
            value: Math.round(res.l3_result.latency_ms * 10) / 10,
          });
        }
      }

      const avgLat =
        numericLatencies.length > 0
          ? Math.round(
              (numericLatencies.reduce((a, b) => a + b, 0) / numericLatencies.length) * 10
            ) / 10
          : null;

      // Devices that require operator intervention (degraded or offline)
      const attention = overview.results.filter(
        (r) => r.overall_status === "degraded" || r.overall_status === "offline"
      );

      // Bklit Ring chart segments with strict aeronautical color semantics
      const segments = [
        { label: "Opérationnels", value: overview.online_devices, color: "#10b981" },
        { label: "Dégradés", value: overview.degraded_devices, color: "#f59e0b" },
        { label: "Hors ligne", value: overview.offline_devices, color: "#ef4444" },
      ];

      return {
        availabilityRate: rate,
        averageLatency: avgLat,
        attentionRequired: attention,
        ringData: segments,
        realLatencyPoints: latencyEntries,
      };
    }, [overview]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-72 rounded-xl lg:col-span-1" />
          <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  // Pure genuine Empty State when database has 0 devices
  if (!overview || overview.total_devices === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground font-sans">
              Vue d'ensemble Opérationnelle
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Supervision des infrastructures et liaisons télécoms ASECNA
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOverview(true)}
            isLoading={isRefreshing}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Actualiser
          </Button>
        </div>

        <Card className="border-dashed p-12 text-center bg-card/40">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
            <Server className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Aucun équipement enregistré</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2 leading-relaxed">
            La base de données SQLite ne contient actuellement aucun équipement sous surveillance.
            Ajoutez vos routeurs, serveurs VHF/HF ou passerelles de communication aéronautique.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button variant="primary" onClick={onOpenAddDevice}>
              <Plus className="h-4 w-4 mr-1.5" />
              Ajouter un équipement
            </Button>
            <Button variant="outline" onClick={() => onNavigate("diagnostics")}>
              Lancer une sonde ad-hoc
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground font-sans">
              État Opérationnel du Réseau
            </h1>
            <Badge variant="outline" className="text-[11px] font-mono">
              CNS / ATM
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
            <span>Disponibilité temps réel des équipements surveillés</span>
            {lastUpdated && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                <Clock className="h-3 w-3" />
                Dernier contrôle à {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOverview(true)}
            isLoading={isRefreshing}
            className="text-xs h-9"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Sonder maintenant
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenAddDevice}
            className="text-xs h-9"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Nouvel équipement
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Primary KPI Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Devices */}
        <Card hoverable className="border-border/80">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Total Équipements
              </p>
              <h4 className="text-3xl font-bold font-sans text-foreground mt-1">
                {overview.total_devices}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-1">Sous supervision continue</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Server className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Online Devices */}
        <Card hoverable className="border-emerald-500/30 dark:border-emerald-500/20">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Opérationnels (L3+L7)
              </p>
              <h4 className="text-3xl font-bold font-sans text-emerald-600 dark:text-emerald-400 mt-1">
                {overview.online_devices}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-1">Connectivité nominale</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Degraded Devices */}
        <Card hoverable className="border-amber-500/30 dark:border-amber-500/20">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Dégradés (L3 OK, L7 HS)
              </p>
              <h4 className="text-3xl font-bold font-sans text-amber-600 dark:text-amber-400 mt-1">
                {overview.degraded_devices}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-1">Service applicatif en panne</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Offline Devices */}
        <Card hoverable className="border-rose-500/30 dark:border-rose-500/20">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                Hors Ligne (L3 HS)
              </p>
              <h4 className="text-3xl font-bold font-sans text-rose-600 dark:text-rose-400 mt-1">
                {overview.offline_devices}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-1">ICMP Ping sans réponse</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <XCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bklit Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Availability Ring Chart (Bklit) */}
        <Card className="lg:col-span-1 flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Radio className="h-4 w-4 text-sky-500" />
              Disponibilité Réseau Globale
            </CardTitle>
            <CardDescription>
              Taux de couverture nominale du parc actif
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-4">
            <RingChart
              data={ringData}
              size={190}
              strokeWidth={14}
              centerLabel={`${availabilityRate}%`}
              centerSublabel="Disponibilité"
            />
          </CardContent>
        </Card>

        {/* Real Latency Trend / Equipment Telemetry (Bklit) */}
        <Card className="lg:col-span-2 flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary dark:text-sky-400" />
                  Télémétrie Latence Réelle (RTT)
                </CardTitle>
                <CardDescription>
                  Temps de transit mesuré sur chaque liaison équipement
                </CardDescription>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold font-mono text-foreground">
                  {averageLatency !== null ? `${averageLatency} ms` : "—"}
                </span>
                <span className="block text-[10px] text-muted-foreground uppercase font-medium">
                  Moyenne active
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2 pb-4">
            <LineChart
              data={realLatencyPoints}
              height={185}
              unit="ms"
              emptyMessage="Aucune mesure de latence disponible (les équipements sont hors ligne ou n'ont pas encore été sondés)."
            />
          </CardContent>
        </Card>
      </div>

      {/* Attention Required Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Équipements Nécessitant une Attention Opérationnelle
            </CardTitle>
            <CardDescription>
              Équipements actuellement dégradés ou inaccessibles sur le réseau
            </CardDescription>
          </div>
          <Badge
            variant={attentionRequired.length > 0 ? "degraded" : "operational"}
            dot
          >
            {attentionRequired.length === 0
              ? "Aucune anomalie"
              : `${attentionRequired.length} critique(s)`}
          </Badge>
        </CardHeader>
        <CardContent className="pt-0">
          {attentionRequired.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <span className="font-semibold block">Réseau 100% nominal</span>
                <span className="text-muted-foreground text-[11px]">
                  Toutes les liaisons L3 (ICMP) et services L7 surveillés répondent normalement.
                </span>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {attentionRequired.map((dev) => (
                <div
                  key={dev.device_id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/30 px-2 rounded-lg transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${
                        dev.overall_status === "offline"
                          ? "bg-rose-500 animate-pulse"
                          : "bg-amber-500"
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground">
                          {dev.device_name}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {dev.ip_address}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {dev.overall_status === "offline"
                          ? `Échec L3 : ${dev.l3_result.error || "Aucun écho ICMP reçu"}`
                          : `L3 OK (${dev.l3_result.latency_ms?.toFixed(1) || 0} ms), mais échec sur service(s) L7`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Badge
                      variant={dev.overall_status === "offline" ? "offline" : "degraded"}
                      className="capitalize text-[11px]"
                    >
                      {dev.overall_status === "offline" ? "Hors Ligne" : "Dégradé"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigate("diagnostics")}
                      className="h-8 text-xs text-primary hover:text-primary"
                    >
                      Diagnostiquer
                      <ArrowUpRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity / Scan summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Wifi className="h-4 w-4 text-primary" />
              Résultats du Dernier Scan Global
            </CardTitle>
            <span className="text-[11px] text-muted-foreground font-mono">
              {overview.results.length} sondé(s)
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {overview.results.map((res) => (
              <div
                key={res.device_id}
                className="p-3 rounded-lg border border-border/70 bg-background/60 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{res.device_name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground truncate">
                    {res.ip_address}
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <Badge
                    variant={
                      res.overall_status === "operational"
                        ? "operational"
                        : res.overall_status === "degraded"
                        ? "degraded"
                        : "offline"
                    }
                    className="text-[10px] py-0 px-2"
                  >
                    {res.overall_status === "operational"
                      ? "En ligne"
                      : res.overall_status === "degraded"
                      ? "Dégradé"
                      : "Hors ligne"}
                  </Badge>
                  {typeof res.l3_result.latency_ms === "number" && (
                    <span className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      {res.l3_result.latency_ms.toFixed(1)} ms
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OverviewPage;
