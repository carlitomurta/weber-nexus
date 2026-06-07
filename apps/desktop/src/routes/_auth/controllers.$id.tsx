import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Radio } from "lucide-react";

import { StatusPill } from "@/components/shared/StatusPill";
import { useControllers } from "@/hooks/useControllers";
import { useSensors } from "@/hooks/useSensors";

import type { Controller } from "../../../types/controllers.type";
import type { Sensor, SensorRegister } from "../../../types/sensors.type";

const emptyControllers: Controller[] = [];
const emptySensors: Sensor[] = [];

export const Route = createFileRoute("/_auth/controllers/$id")({
  head: ({ params }) => ({
    meta: [{ title: `${params.id ?? "Controlador"}` }],
  }),
  component: ControllerDetail,
});

interface MetaCardProps {
  label: string;
  value: string;
}

interface SensorRowProps {
  sensor: Sensor;
}

interface ReadingProps {
  register: SensorRegister;
}

interface RouteStateProps {
  message: string;
}

interface RouteQueryStateProps {
  isOffline: boolean;
  isStale: boolean;
}

function ControllerDetail() {
  const { id } = Route.useParams();
  const controllerId = Number(id);
  const controllersQuery = useControllers();
  const sensorsQuery = useSensors();
  const controllers = controllersQuery.data ?? emptyControllers;
  const sensors = sensorsQuery.data ?? emptySensors;
  const selectedController =
    controllers.find((controller) => controller.id === controllerId) ?? null;
  const selectedSensors = sensors.filter(
    (sensor) => sensor.controllerId === controllerId,
  );
  const isLoading = controllersQuery.isLoading || sensorsQuery.isLoading;
  const isError = controllersQuery.isError || sensorsQuery.isError;
  const isStale = controllersQuery.isStale || sensorsQuery.isStale;
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  if (isLoading) {
    return <RouteState message="Carregando controlador..." />;
  }

  if (isError) {
    return <RouteState message="Não foi possível carregar o controlador." />;
  }

  if (!selectedController) {
    return <RouteState message="Controlador não encontrado." />;
  }

  return (
    <div>
      <Link
        to="/controllers"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Voltar aos controladores
      </Link>
      <RouteQueryState isOffline={isOffline} isStale={isStale} />
      <div className="flex items-end justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
            <Radio className="size-3" /> Banner Engineering
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {selectedController.name}
          </h1>
          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
            <span>{selectedController.site}</span>
            <span className="font-mono text-xs">
              {selectedController.ipAddress}
            </span>
            <span className="font-mono text-xs">
              POLLING · {selectedController.pollingIntervalMs / 1000}s
            </span>
          </div>
        </div>
        <StatusPill status="online" />
      </div>
      <div className="grid grid-cols-4 gap-4 py-5">
        <MetaCard label="Modelo" value={selectedController.model} />
        <MetaCard label="Sensores" value={String(selectedSensors.length)} />
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Sensores conectados</h2>
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-mono tracking-[0.14em] text-muted-foreground">
              CONFIGURAÇÃO LOCAL
            </div>
          </div>
        </div>
        {selectedSensors.length === 0 ? (
          <RouteState message="Nenhum sensor configurado para este controlador." />
        ) : (
          <div className="space-y-3">
            {selectedSensors.map((sensor) => (
              <SensorRow key={sensor.id} sensor={sensor} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetaCard({ label, value }: MetaCardProps) {
  return (
    <div className="rounded border border-border bg-card/60 p-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SensorRow({ sensor }: SensorRowProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card/60">
      <div className="grid grid-cols-12 gap-0">
        <div className="col-span-3 space-y-3 border-r border-border p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-medium">{sensor.name}</div>
              <div className="mt-0.5 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                {sensor.model ?? "Sem modelo"}
              </div>
            </div>
            <StatusPill status="online" />
          </div>

          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3" /> {sensor.location ?? "Sem local"}
            </div>
          </div>
        </div>

        <div className="col-span-9 grid grid-cols-4 gap-3 p-4">
          {sensor.registers.length === 0 ? (
            <div className="col-span-4 text-xs text-muted-foreground">
              Nenhum registro configurado.
            </div>
          ) : (
            sensor.registers.map((register) => (
              <Reading
                key={`${sensor.id}-${register.name}-${register.address}`}
                register={register}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Reading({ register }: ReadingProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
        {register.name}
      </div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums text-primary">
        {register.address}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          {register.unit}
        </span>
      </div>
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
    <div className="my-4 rounded border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      {isOffline
        ? "Offline: exibindo dados locais disponíveis."
        : "Dados possivelmente desatualizados."}
    </div>
  );
}
