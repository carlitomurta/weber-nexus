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
import { useControllers } from "@/hooks/react-query/useControllers";
import {
  type InfluxReadingsRange,
  pollingRefetchInterval,
  useInfluxReadings,
} from "@/hooks/react-query/useInfluxReadings";
import { apiErrorMessage } from "@/lib/api";

import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import type { Controller } from "../../../types/controllers.type";
import type { InfluxSensorReading } from "../../../types/influxdb.type";

const emptyControllers: Controller[] = [];
const emptyReadings: InfluxSensorReading[] = [];
const rangeOptions: { label: string; value: InfluxReadingsRange }[] = [
  { label: "Última semana", value: "1w" },
  { label: "6 meses", value: "6m" },
  { label: "1 ano", value: "1y" },
  { label: "2 anos", value: "2y" },
];
const chartPalette = [
  { color: "var(--primary)", swatchClassName: "bg-primary" },
  { color: "var(--warning)", swatchClassName: "bg-warning" },
  { color: "var(--success)", swatchClassName: "bg-success" },
  { color: "#38bdf8", swatchClassName: "bg-sky-400" },
  { color: "#f472b6", swatchClassName: "bg-pink-400" },
  { color: "#a78bfa", swatchClassName: "bg-violet-400" },
  { color: "#fb7185", swatchClassName: "bg-rose-400" },
  { color: "#34d399", swatchClassName: "bg-emerald-400" },
];

export const Route = createFileRoute("/_auth/dashboard")({
  head: () => ({
    meta: [{ title: "Painel" }],
  }),
  component: Dashboard,
});

interface DashboardStateProps {
  message: string;
}

function Dashboard() {
  const [selectedRange, setSelectedRange] = useState<InfluxReadingsRange>("6m");
  const [selectedControllerId, setSelectedControllerId] = useState<
    number | null
  >(null);
  const controllersQuery = useControllers();
  const controllers = controllersQuery.data ?? emptyControllers;
  const selectedController = useMemo(
    () =>
      controllers.find(
        (controller) => controller.id === selectedControllerId,
      ) ??
      controllers[0] ??
      null,
    [controllers, selectedControllerId],
  );
  const readingsQuery = useInfluxReadings(selectedController, selectedRange);
  const readings = readingsQuery.data ?? emptyReadings;
  const latestReadings = latestRegisterReadings(readings);
  const chartSeries = buildChartSeries(readings);
  const chartRows = buildChartRows(readings, chartSeries);
  const lastReadingAt = latestReadings[0]?.time ?? null;
  const refetchIntervalMs = pollingRefetchInterval(
    selectedController ? [selectedController] : controllers,
  );

  useEffect(() => {
    if (selectedControllerId === null && controllers.length > 0) {
      setSelectedControllerId(controllers[0].id);
      return;
    }

    if (
      selectedControllerId !== null &&
      !controllers.some((controller) => controller.id === selectedControllerId)
    ) {
      setSelectedControllerId(controllers[0]?.id ?? null);
    }
  }, [controllers, selectedControllerId]);

  return (
    <>
      <div className="flex items-end justify-between">
        <PageTitle
          page="Visão geral"
          title={selectedController?.name ?? "Planta AMBEV"}
          subtitle={`Telemetria local de ${controllers.length} controladores cadastrados`}
        />
        <div className="text-right font-mono text-xs text-muted-foreground">
          <div>Última leitura · {formatLocalDateTime(lastReadingAt)}</div>
          <div>Próxima atualização · {formatInterval(refetchIntervalMs)}</div>
        </div>
      </div>
      <hr />
      <ChartCard
        title="Registros em tempo real"
        subtitle={`${selectedController?.ipAddress ?? "sem controlador"} · Última leitura ${formatLocalDateTime(lastReadingAt)}`}
        className="lg:col-span-2"
        action={
          <ChartFilters
            controllers={controllers}
            selectedControllerId={selectedController?.id ?? null}
            selectedRange={selectedRange}
            onSelectController={setSelectedControllerId}
            onSelectRange={setSelectedRange}
          />
        }
      >
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart
            data={chartRows}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <defs>
              {chartSeries.map((series) => (
                <linearGradient
                  key={series.gradientId}
                  id={series.gradientId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={series.color}
                    stopOpacity={0.42}
                  />
                  <stop
                    offset="100%"
                    stopColor={series.color}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
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
            {chartSeries.map((series) => (
              <Area
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={series.color}
                strokeWidth={1.5}
                fill={`url(#${series.gradientId})`}
                connectNulls
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
        <ChartLegend items={chartSeries} />
        {readingsQuery.isError ? (
          <div className="mt-2 text-[11px] text-destructive">
            {apiErrorMessage(
              readingsQuery.error,
              "Não foi possível carregar os dados do InfluxDB.",
            )}
          </div>
        ) : null}
      </ChartCard>
      <hr />
      <div className="border border-border rounded-lg bg-card/60 overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Controladores</h2>
            <p className="text-xs text-muted-foreground">
              Selecione o controlador do gráfico ou inspecione sensores
              conectados
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
                  className={`group border-t border-border transition-colors hover:bg-muted/30 ${
                    selectedController?.id === controller.id
                      ? "bg-muted/20"
                      : ""
                  }`}
                >
                  <td className="px-5 py-3 font-medium">
                    <button
                      type="button"
                      onClick={() => setSelectedControllerId(controller.id)}
                      className="text-left hover:text-primary"
                    >
                      {controller.name}
                    </button>
                  </td>
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

type ChartSeries = {
  key: string;
  label: string;
  color: string;
  gradientId: string;
  swatchClassName: string;
};

type ChartRow = {
  time: string;
  timestamp: number;
} & Record<string, string | number | null>;

function buildChartSeries(readings: InfluxSensorReading[]): ChartSeries[] {
  const seriesByKey = new Map<string, ChartSeries>();

  metricReadings(readings).forEach((reading) => {
    const key = registerChartKey(reading);

    if (seriesByKey.has(key)) return;

    const paletteItem = stableChartPaletteItem(key);

    seriesByKey.set(key, {
      key,
      label: `${reading.register_name} · ${reading.sensor_name}`,
      color: paletteItem.color,
      gradientId: `${key}_gradient`,
      swatchClassName: paletteItem.swatchClassName,
    });
  });

  return [...seriesByKey.values()];
}

function buildChartRows(
  readings: InfluxSensorReading[],
  series: ChartSeries[],
): ChartRow[] {
  const metricRows = metricReadings(readings).sort(
    (left, right) =>
      new Date(left.time).getTime() - new Date(right.time).getTime(),
  );
  const rowsByTimestamp = new Map<number, ChartRow>();

  metricRows.forEach((reading) => {
    const timestamp = new Date(reading.time).getTime();
    const key = registerChartKey(reading);
    const row =
      rowsByTimestamp.get(timestamp) ??
      ({
        timestamp,
        time: formatLocalTime(reading.time),
      } as ChartRow);

    row[key] = reading.scaled_value ?? reading.raw_value ?? null;
    rowsByTimestamp.set(timestamp, row);
  });

  return [...rowsByTimestamp.values()]
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((row) => {
      series.forEach((item) => {
        row[item.key] ??= null;
      });

      return row;
    });
}

function metricReadings(readings: InfluxSensorReading[]) {
  return readings.filter(
    (reading) =>
      reading.register_kind === "metric" &&
      (typeof reading.scaled_value === "number" ||
        typeof reading.raw_value === "number"),
  );
}

function registerChartKey(reading: InfluxSensorReading): string {
  return [
    "register",
    reading.controller_id,
    reading.sensor_id,
    reading.register_address,
  ].join("_");
}

function stableChartPaletteItem(value: string): (typeof chartPalette)[number] {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return chartPalette[hash % chartPalette.length];
}

function formatLocalDateTime(value: string | null): string {
  if (!value) return "sem leitura";

  return dayjs.utc(value).tz("America/Sao_Paulo").format("DD/MM/YYYY HH:mm:ss");
}

function formatLocalTime(value: string): string {
  return dayjs.utc(value).tz("America/Sao_Paulo").format("HH:mm:ss");
}

function formatInterval(intervalMs: number): string {
  if (intervalMs < 60000) return `a cada ${Math.round(intervalMs / 1000)}s`;
  return `a cada ${Math.round(intervalMs / 60000)}min`;
}

function ChartCard({
  title,
  subtitle,
  className,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`border border-border rounded-lg bg-card/60 p-4 ${className ?? ""}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ChartFilters({
  controllers,
  selectedControllerId,
  selectedRange,
  onSelectController,
  onSelectRange,
}: {
  controllers: Controller[];
  selectedControllerId: number | null;
  selectedRange: InfluxReadingsRange;
  onSelectController: (controllerId: number) => void;
  onSelectRange: (range: InfluxReadingsRange) => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-2">
      <select
        value={selectedControllerId ?? ""}
        onChange={(event) => onSelectController(Number(event.target.value))}
        className="h-8 rounded-md border border-border bg-background px-2 text-[11px] text-foreground outline-none"
      >
        {controllers.map((controller) => (
          <option key={controller.id} value={controller.id}>
            {controller.name}
          </option>
        ))}
      </select>
      <div className="inline-flex rounded-md border border-border bg-background p-0.5">
        {rangeOptions.map((option) => {
          const active = option.value === selectedRange;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelectRange(option.value)}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChartLegend({ items }: { items: ChartSeries[] }) {
  if (items.length === 0) {
    return (
      <div className="mt-2 text-[11px] text-muted-foreground">
        Sem registros métricos para o gráfico.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 mt-2 flex-wrap">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center gap-1.5 text-[10px] font-mono tracking-[0.12em] uppercase text-muted-foreground"
        >
          <span
            className={`inline-block size-2 rounded-sm ${it.swatchClassName}`}
          />
          {it.label}
        </div>
      ))}
    </div>
  );
}
