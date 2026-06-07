import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageTitle } from "@/components/shared/PageTitle";
import { useControllers } from "@/hooks/useControllers";
import {
  pollingRefetchInterval,
  useInfluxReadings,
} from "@/hooks/useInfluxReadings";

import type { Controller } from "../../../types/controllers.type";
import type { InfluxSensorReading } from "../../../types/influxdb.type";

const emptyControllers: Controller[] = [];
const emptyReadings: InfluxSensorReading[] = [];

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
  const readingsQuery = useInfluxReadings(controllers);
  const readings = readingsQuery.data ?? emptyReadings;
  const latestReadings = latestRegisterReadings(readings);
  const chartRows = buildChartRows(readings);
  const lastReadingAt = latestReadings[0]?.time ?? null;
  const refetchIntervalMs = pollingRefetchInterval(controllers);
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <>
      <div className="flex items-end justify-between">
        <PageTitle
          page="Visão geral"
          title="Planta AMBEV"
          subtitle={`Telemetria local de ${controllers.length} controladores cadastrados`}
        />
        <div className="text-right font-mono text-xs text-muted-foreground">
          <div>Última leitura · {formatRelativeTime(lastReadingAt)}</div>
          <div>Próxima atualização · {formatInterval(refetchIntervalMs)}</div>
        </div>
      </div>
      <hr />
      <ChartCard
        title="Registros em tempo real"
        subtitle={`Última leitura ${formatRelativeTime(lastReadingAt)}`}
        className="lg:col-span-2"
      >
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart
            data={chartRows}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <defs>
              <linearGradient id="register1" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--primary)"
                  stopOpacity={0.5}
                />
                <stop
                  offset="100%"
                  stopColor="var(--primary)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 11,
              }}
              labelStyle={{ color: "var(--muted-foreground)" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--warning)"
              strokeWidth={1.5}
              fill="url(#register1)"
            />
          </AreaChart>
        </ResponsiveContainer>
        <ChartLegend
          items={[{ color: "var(--primary)", label: "Registros métricos" }]}
        />
      </ChartCard>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {readingsQuery.isLoading ? (
          <RegisterState message="Carregando leituras..." />
        ) : readingsQuery.isError ? (
          <RegisterState message="Não foi possível carregar leituras." />
        ) : latestReadings.length === 0 ? (
          <RegisterState message="Sem leituras do InfluxDB ainda." />
        ) : (
          latestReadings
            .slice(0, 8)
            .map((reading) => (
              <RegisterReadingCard
                key={`${reading.controller_id}-${reading.sensor_id}-${reading.register_address}`}
                reading={reading}
              />
            ))
        )}
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

function RegisterState({ message }: DashboardStateProps) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-5 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-4">
      {message}
    </div>
  );
}

function RegisterReadingCard({ reading }: { reading: InfluxSensorReading }) {
  const health = reading.register_kind === "health";

  return (
    <div className="rounded-lg border border-border bg-card/60 p-4">
      <div className="truncate text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
        {reading.controller_name} · {reading.sensor_name}
      </div>
      <div className="mt-1 truncate text-sm font-medium">
        {reading.register_name}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xl font-semibold tabular-nums text-primary">
            {formatReadingValue(reading)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
            Endereço {reading.register_address}
          </div>
        </div>
        <div
          className={`rounded px-2 py-1 text-[10px] font-mono uppercase tracking-[0.12em] ${
            health
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {health ? "Health" : "Métrica"}
        </div>
      </div>
      <div className="mt-3 text-[11px] text-muted-foreground">
        Última leitura {formatRelativeTime(reading.time)}
      </div>
    </div>
  );
}

function DashboardState({ message }: DashboardStateProps) {
  return (
    <div className="p-5 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function latestRegisterReadings(
  readings: InfluxSensorReading[],
): InfluxSensorReading[] {
  const latest = new Map<string, InfluxSensorReading>();

  for (const reading of readings) {
    const key = [
      reading.controller_id,
      reading.sensor_id,
      reading.register_address,
    ].join(":");
    const current = latest.get(key);

    if (!current || new Date(reading.time) > new Date(current.time)) {
      latest.set(key, reading);
    }
  }

  return [...latest.values()].sort(
    (left, right) =>
      new Date(right.time).getTime() - new Date(left.time).getTime(),
  );
}

function buildChartRows(readings: InfluxSensorReading[]) {
  return readings
    .filter(
      (reading) =>
        reading.register_kind === "metric" &&
        typeof reading.scaled_value === "number",
    )
    .slice(0, 60)
    .reverse()
    .map((reading) => ({
      time: new Date(reading.time).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      name: reading.register_name,
      value: reading.scaled_value,
    }));
}

function formatReadingValue(reading: InfluxSensorReading): string {
  if (reading.register_kind === "health") {
    return reading.status_text ?? "UNKNOWN";
  }

  const value =
    typeof reading.scaled_value === "number"
      ? reading.scaled_value
      : reading.raw_value;

  return `${formatNumber(value)}${reading.unit ? ` ${reading.unit}` : ""}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 3,
  }).format(value);
}

function formatRelativeTime(value: string | null): string {
  if (!value) return "sem leitura";

  const elapsedMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "agora";

  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  if (elapsedSeconds < 5) return "agora";
  if (elapsedSeconds < 60) return `há ${elapsedSeconds}s`;

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `há ${elapsedMinutes}min`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return `há ${elapsedHours}h`;
}

function formatInterval(intervalMs: number): string {
  if (intervalMs < 60000) return `a cada ${Math.round(intervalMs / 1000)}s`;
  return `a cada ${Math.round(intervalMs / 60000)}min`;
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

function ChartCard({
  title,
  subtitle,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`border border-border rounded-lg bg-card/60 p-4 ${className ?? ""}`}
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function ChartLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-4 mt-2 flex-wrap">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center gap-1.5 text-[10px] font-mono tracking-[0.12em] uppercase text-muted-foreground"
        >
          <span
            className="inline-block size-2 rounded-sm"
            style={{ background: it.color }}
          />
          {it.label}
        </div>
      ))}
    </div>
  );
}
