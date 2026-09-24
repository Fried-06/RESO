import React, { useEffect, useState } from "react";
import { Sun, Moon, LogOut, ShieldCheck, Bell } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { Button, Badge } from "@/components/ui";
import * as alertService from "@/services/tauri/alerts";
import type { AlertSummary } from "@/types/alert";
import logoAsecna from "@/assets/Logo_ASECNA.png";

interface HeaderProps {
  onAlertClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onAlertClick }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, token, logout } = useAuth();
  const [alertSummary, setAlertSummary] = useState<AlertSummary | null>(null);

  // Poll alert summary every 15s
  useEffect(() => {
    if (!token) return;
    const fetchSummary = async () => {
      try {
        const summary = await alertService.getAlertSummary(token);
        setAlertSummary(summary);
      } catch {
        // Silent - best effort
      }
    };
    fetchSummary();
    const interval = setInterval(fetchSummary, 15000);
    return () => clearInterval(interval);
  }, [token]);

  const roleLabel = user?.role === "admin" ? "Administrateur" : "Opérateur";
  const unreadCount = alertSummary?.unread_count ?? 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur-md transition-colors">
      <div className="flex h-16 items-center justify-between px-4 md:px-8">
        {/* Left: ASECNA Institutional Brand */}
        <div className="flex items-center gap-3.5">
          <img
            src={logoAsecna}
            alt="ASECNA Logo"
            className="h-10 w-auto object-contain select-none"
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm md:text-base tracking-tight text-foreground uppercase">
                ASECNA Network Monitor
              </span>
              <Badge variant="outline" className="hidden sm:inline-flex text-[10px] py-0 px-1.5 font-semibold">
                L3 / L7
              </Badge>
            </div>
            <span className="text-[11px] text-muted-foreground hidden sm:block">
              Supervision &amp; Diagnostic d'Infrastructure Réseau
            </span>
          </div>
        </div>

        {/* Right: Engine Indicator, Alerts, Theme Toggle & User Info */}
        <div className="flex items-center gap-2.5 md:gap-4">
          {/* Operational Engine status */}
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Moteur Actif</span>
          </div>

          {/* Alert bell with badge */}
          <button
            onClick={onAlertClick}
            className="relative h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Alertes"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 shadow-sm animate-in zoom-in duration-200">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* Theme switcher */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-lg"
            title={theme === "dark" ? "Mode clair" : "Mode sombre"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* User badge and Logout */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-muted/40">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase">
                  {user.username.charAt(0)}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-semibold text-foreground leading-none">
                    {user.username}
                  </span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="h-2.5 w-2.5 text-accent" />
                    {roleLabel}
                  </span>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="h-8 w-8 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 rounded-lg"
                title="Déconnexion"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
