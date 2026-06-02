import { PageTitle } from "@/components/shared/PageTitle";
import { useControllers } from "@/hooks/useControllers";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/_auth/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard" }],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: controllers = [], isLoading } = useControllers();

  return (
    <div className="max-w-400">
      {/* Header */}
      <div className="flex items-end justify-between">
        <PageTitle
          page="Visão geral"
          title="Planta AMBEV"
          subtitle="Telemetria em tempo real de 4 controladores · 16 sensores"
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
        {isLoading ? (
          <div className="p-5 text-center text-sm text-muted-foreground">
            Carregando controladores...
          </div>
        ) : controllers?.length === 0 ? (
          <div className="p-5 text-center text-sm text-muted-foreground">
            Nenhum controlador encontrado. Adicione um novo controlador para
            começar a monitorar seus sensores.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[10px] font-mono tracking-[0.14em] text-muted-foreground uppercase bg-muted/30">
              <tr>
                <th className="text-left px-5 py-2.5 font-normal">
                  Controlador
                </th>
                <th className="text-left px-5 py-2.5 font-normal">Modelo</th>
                <th className="text-left px-5 py-2.5 font-normal">IP</th>
                <th className="text-left px-5 py-2.5 font-normal">Local</th>
                {/* <th className="text-left px-5 py-2.5 font-normal">Status</th> */}
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {controllers.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-border hover:bg-muted/30 transition-colors group"
                >
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                    {c.model}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                    {c.ipAddress}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                    {c.site}
                  </td>
                  {/* <td className="px-5 py-3">
                  <StatusPill status={c.status} />
                </td> */}
                  <td className="px-5 py-3 text-right">
                    <Link
                      to="/controllers/$id"
                      params={{ id: String(c.id) }}
                      className="inline-flex items-center gap-1 text-xs text-primary opacity-60 group-hover:opacity-100 transition"
                    >
                      Inspecionar <ArrowUpRight className="size-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
