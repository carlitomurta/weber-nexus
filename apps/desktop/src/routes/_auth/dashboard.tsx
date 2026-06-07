import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { PageTitle } from "@/components/shared/PageTitle";
import { useControllers } from "@/hooks/useControllers";

import type { Controller } from "../../../types/controllers.type";

const emptyControllers: Controller[] = [];

export const Route = createFileRoute("/_auth/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard" }],
  }),
  component: Dashboard,
});

interface DashboardStateProps {
  message: string;
}

interface DashboardQueryStateProps {
  isOffline: boolean;
  isStale: boolean;
}

function Dashboard() {
  const controllersQuery = useControllers();
  const controllers = controllersQuery.data ?? emptyControllers;
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <>
      <div className="flex items-end justify-between">
        <PageTitle
          page="Visão geral"
          title="Planta AMBEV"
          subtitle={`Telemetria local de ${controllers.length} controladores cadastrados`}
        />
        <div className="text-right font-mono text-[11px] text-muted-foreground">
          <div>Último pull · há 1 minuto</div>
          <div>Polling a cada · 5 minutos</div>
        </div>
      </div>
      <hr />
      <div className="border border-border rounded-lg bg-card/60 overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Controladores</h2>
            <p className="text-xs text-muted-foreground">
              Clique em uma linha para inspecionar os sensores conectados
            </p>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground tracking-[0.16em]">
            {controllers?.length ?? 0} TOTAL
          </div>
        </div>
        {controllersQuery.isLoading ? (
          <DashboardState message="Carregando controladores..." />
        ) : controllersQuery.isError ? (
          <DashboardState message="Não foi possível carregar controladores." />
        ) : controllers.length === 0 ? (
          <DashboardState message="Nenhum controlador encontrado. Adicione um novo controlador para começar a monitorar seus sensores." />
        ) : (
          <>
            <DashboardQueryState
              isOffline={isOffline}
              isStale={controllersQuery.isStale}
            />
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-2.5 text-left font-normal">
                    Controlador
                  </th>
                  <th className="px-5 py-2.5 text-left font-normal">Modelo</th>
                  <th className="px-5 py-2.5 text-left font-normal">IP</th>
                  <th className="px-5 py-2.5 text-left font-normal">Local</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {controllers.map((controller) => (
                  <tr
                    key={controller.id}
                    className="group border-t border-border transition-colors hover:bg-muted/30"
                  >
                    <td className="px-5 py-3 font-medium">{controller.name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {controller.model}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {controller.ipAddress}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {controller.site}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to="/controllers/$id"
                        params={{ id: String(controller.id) }}
                        className="inline-flex items-center gap-1 text-xs text-primary opacity-60 transition group-hover:opacity-100"
                      >
                        Inspecionar <ArrowUpRight className="size-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}

function DashboardState({ message }: DashboardStateProps) {
  return (
    <div className="p-5 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function DashboardQueryState({ isOffline, isStale }: DashboardQueryStateProps) {
  if (!isOffline && !isStale) {
    return null;
  }

  return (
    <div className="border-b border-border bg-muted/30 px-5 py-2 text-xs text-muted-foreground">
      {isOffline
        ? "Offline: exibindo dados locais disponíveis."
        : "Dados possivelmente desatualizados."}
    </div>
  );
}
