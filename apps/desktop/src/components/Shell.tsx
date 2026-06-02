import { currentUser } from "@/lib/auth";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Cog,
  Cpu,
  LayoutDashboard,
  LogOut,
  Radio,
} from "lucide-react";
import { useEffect, useState } from "react";

const nav = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { to: "/controllers", label: "Controladores", icon: Cpu },
  { to: "/settings", label: "Configurações", icon: Cog },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [version, setVersion] = useState<string>("");
  const user = currentUser();
  useEffect(() => {
    (async () => {
      const version = await window.electron.app.getVersion();
      setVersion(version);
    })();
  }, []);

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-border bg-card/60 backdrop-blur flex flex-col">
        <div className="px-5 py-5 border-b border-border flex items-center gap-2.5">
          <div className="size-8 rounded bg-primary grid place-items-center text-primary-foreground">
            <Radio className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">NEXUS</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Webercom Tech · v{version}
            </div>
          </div>
        </div>

        <nav className="p-3 flex-1 space-y-1">
          {nav.map((item) => {
            const active =
              path === item.to ||
              (item.to !== "/dashboard" && path.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors ${
                  active
                    ? "bg-primary/15 text-primary border-l-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="px-3 py-2 mb-2 rounded bg-muted/40">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="size-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-muted-foreground">
                InfluxDB · conectado
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] mt-1">
              <span className="size-1.5 rounded-full bg-success" />
              <span className="text-muted-foreground">SQLite · local</span>
            </div>
          </div>
          <Link
            to="/login"
            className="flex items-center gap-2 px-3 py-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            <LogOut className="size-3.5" /> Desconectar
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-background/70 backdrop-blur flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <Activity className="size-3.5 text-warning" />
            <span>OFFLINE · última sincronização há 20 minutos</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="font-mono uppercase">{user?.name}</span>
            <span className="size-2 rounded-full bg-success" />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
