import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Cpu } from "lucide-react";

import { PageTitle } from "@/components/shared/PageTitle";
import { useControllers } from "@/hooks/useControllers";
import { useSensors } from "@/hooks/useSensors";

import type { Controller } from "../../../types/controllers.type";
import type { Sensor } from "../../../types/sensors.type";

const emptyControllers: Controller[] = [];
const emptySensors: Sensor[] = [];

export const Route = createFileRoute("/_auth/controllers/")({
  head: () => ({ meta: [{ title: "Controladores" }] }),
  component: ControllersPage,
});

interface ControllerCardProps {
  controller: Controller;
  sensorCount: number;
}

interface StatProps {
  label: string;
  value: number;
}

interface RouteStateProps {
  message: string;
}

interface RouteQueryStateProps {
  isOffline: boolean;
  isStale: boolean;
}

function ControllersPage() {
  const controllersQuery = useControllers();
  const sensorsQuery = useSensors();
  const controllers = controllersQuery.data ?? emptyControllers;
  const sensors = sensorsQuery.data ?? emptySensors;
  const isLoading = controllersQuery.isLoading || sensorsQuery.isLoading;
  const isError = controllersQuery.isError || sensorsQuery.isError;
  const isStale = controllersQuery.isStale || sensorsQuery.isStale;
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <>
      <div className="pb-5">
        <PageTitle
          page="Planta AMBEV"
          title="Controladores"
          subtitle={`${controllers.length} controladores cadastrados · ${sensors.length} sensores configurados`}
        />
      </div>
      <hr />

      {isLoading ? (
        <RouteState message="Carregando controladores..." />
      ) : isError ? (
        <RouteState message="Não foi possível carregar controladores." />
      ) : controllers.length === 0 ? (
        <RouteState message="Nenhum controlador cadastrado." />
      ) : (
        <>
          <RouteQueryState isOffline={isOffline} isStale={isStale} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {controllers.map((controller) => (
              <ControllerCard
                key={controller.id}
                controller={controller}
                sensorCount={
                  sensors.filter(
                    (sensor) => sensor.controllerId === controller.id,
                  ).length
                }
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ControllerCard({ controller, sensorCount }: ControllerCardProps) {
  return (
    <Link
      to="/controllers/$id"
      params={{ id: String(controller.id) }}
      className="group rounded-lg border border-border bg-card/60 p-4 transition-colors hover:border-primary/60 hover:bg-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded bg-primary/10 text-primary">
            <Cpu className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {controller.name}
            </div>
            <div className="mt-0.5 truncate text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
              {controller.model} · {controller.ipAddress}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        {controller.site}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Sensores" value={sensorCount} />
        <Stat label="Porta" value={controller.port ?? 0} />
        <Stat label="Polling" value={controller.pollingIntervalMs / 1000} />
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
        <span>{controller.isMultihop ? "MULTIHOP" : "LOCAL"}</span>
        <span className="inline-flex items-center gap-1 text-primary opacity-0 transition group-hover:opacity-100">
          abrir <ChevronRight className="size-3" />
        </span>
      </div>
    </Link>
  );
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="rounded border border-border bg-background/40 px-2 py-1.5">
      <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function RouteState({ message }: RouteStateProps) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function RouteQueryState({ isOffline, isStale }: RouteQueryStateProps) {
  if (!isOffline && !isStale) {
    return null;
  }

  return (
    <div className="mb-4 rounded border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      {isOffline
        ? "Offline: exibindo dados locais disponíveis."
        : "Dados possivelmente desatualizados."}
    </div>
  );
}
