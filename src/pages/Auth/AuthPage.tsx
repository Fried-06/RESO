import React, { useState } from "react";
import { Shield, KeyRound, User, Lock, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button, Input, Card, Badge } from "@/components/ui";
import logoAsecna from "@/assets/Logo_ASECNA.png";
import aircraftImg from "@/assets/6v-cev-asecna-cessna-680-citation-sovereign_PlanespottersNet_1171109_5e2cdd0ecb_o.jpg";

export const AuthPage: React.FC = () => {
  const { bootstrapRequired, login, createFirstUser } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("Veuillez renseigner tous les champs requis.");
      return;
    }

    if (bootstrapRequired) {
      if (password.length < 8) {
        setError("Le mot de passe doit comporter au moins 8 caractères.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Les mots de passe ne correspondent pas.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (bootstrapRequired) {
        await createFirstUser({ username: username.trim(), password });
      } else {
        await login({ username: username.trim(), password });
      }
    } catch (err: unknown) {
      console.error("Auth error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Échec de l'authentification. Vérifiez vos identifiants.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background text-foreground select-none">
      {/* Left / Hero section: ASECNA Aviation Identity */}
      <div className="relative md:w-1/2 min-h-70 md:min-h-screen flex flex-col justify-between p-6 md:p-12 overflow-hidden bg-[#0B2545] text-white">
        {/* Background Aircraft image with institutional gradient overlay */}
        <img
          src={aircraftImg}
          alt="ASECNA Citation Sovereign"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-30 mix-blend-luminosity scale-105 transition-transform duration-10000 hover:scale-100"
        />
        <div className="absolute inset-0 bg-linear-to-t from-[#0B2545] via-[#0B2545]/80 to-[#0B2545]/50" />

        {/* Top brand */}
        <div className="relative z-10 flex items-center gap-3">
          <img src={logoAsecna} alt="ASECNA" className="h-12 w-auto bg-white/10 p-1.5 rounded-lg backdrop-blur-xs border border-white/20" />
          <div>
            <h1 className="font-bold text-lg tracking-wider uppercase">ASECNA</h1>
            <p className="text-xs text-sky-200">Agence pour la Sécurité de la Navigation Aérienne</p>
          </div>
        </div>

        {/* Middle message */}
        <div className="relative z-10 my-auto py-8">
          <Badge variant="accent" className="bg-sky-500/20 text-sky-300 border-sky-400/30 mb-4 px-3 py-1">
            Supervision Réseau Haute Disponibilité
          </Badge>
          <h2 className="text-2xl md:text-4xl font-bold tracking-tight leading-tight text-white mb-3">
            Surveillance & Diagnostic des Infrastructures Critiques
          </h2>
          <p className="text-sm md:text-base text-sky-100/80 max-w-md leading-relaxed">
            Plateforme de contrôle L3 (ICMP) et L7 (TCP/HTTP) assurant la résilience opérationnelle des centres de navigation aérienne.
          </p>

          <div className="mt-6 flex flex-wrap gap-4 text-xs text-sky-200/80">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Sonde L3 ICMP temps réel
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Agrégation diagnostique L7
            </span>
          </div>
        </div>

        {/* Bottom footer badge */}
        <div className="relative z-10 flex items-center justify-between text-xs text-sky-300/70 border-t border-white/10 pt-4">
          <span>Direction de l'Exploitation Technique</span>
          <span>Version 2.0-L7</span>
        </div>
      </div>

      {/* Right section: Authentication Form */}
      <div className="md:w-1/2 flex items-center justify-center p-6 md:p-12">
        <Card className="w-full max-w-md border-border/80 shadow-xl shadow-black/5 p-6 md:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {bootstrapRequired ? (
                <Shield className="h-6 w-6 text-accent" />
              ) : (
                <KeyRound className="h-6 w-6 text-primary" />
              )}
            </div>

            <h3 className="text-xl font-bold tracking-tight text-foreground">
              {bootstrapRequired
                ? "Initialisation Administrateur"
                : "Authentification Opérateur"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {bootstrapRequired
                ? "Créez le compte administrateur initial pour configurer le système."
                : "Veuillez vous identifier pour accéder à la console de supervision."}
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Identifiant Opérateur
              </label>
              <Input
                type="text"
                placeholder="ex: admin ou technicien.cns"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                icon={<User className="h-4 w-4" />}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Mot de passe
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="h-4 w-4" />}
                required
              />
              {bootstrapRequired && (
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Minimum 8 caractères.
                </span>
              )}
            </div>

            {bootstrapRequired && (
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Confirmer le mot de passe
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  icon={<Lock className="h-4 w-4" />}
                  required
                />
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={isSubmitting}
            >
              <span>{bootstrapRequired ? "Initialiser la console" : "Accéder à la supervision"}</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
