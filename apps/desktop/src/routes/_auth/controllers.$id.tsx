import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Radio } from "lucide-react";

import { StatusPill, type SensorStatus } from "@/components/shared/StatusPill";
import { useControllers } from "@/hooks/useControllers";
import { useInfluxReadings } from "@/hooks/useInfluxReadings";
import { useSensors } from "@/hooks/useSensors";
import { apiErrorMessage } from "@/lib/api";
import { formatPollingInterval } from "@/utils/formatPollingInterval";

import type { Controller } from "../../../types/controllers.type";
import type { InfluxSensorReading } from "../../../types/influxdb.type";
import type { Sensor, SensorRegister } from "../../../types/sensors.type";

const emptyControllers: Controller[] = [];
const emptyReadings: InfluxSensorReading[] = [];
const emptySensors: Sensor[] = [];
const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 3,
});

export const Route = createFileRoute("/_auth/controllers/$id")({
  head: () => ({
    meta: [{ title: "Controlador" }],
  }),
  component: ControllerDetail,
});

interface MetaCardProps {
  label: string;
  value: string;
}

interface SensorRowProps {
  sensor: Sensor;
  latestReadings: Map<string, InfluxSensorReading>;
  status: SensorStatus;
}

interface ReadingProps {
  register: SensorRegister;
  reading: InfluxSensorReading | undefined;
}

interface RouteStateProps {
  message: string;
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
  const readingsQuery = useInfluxReadings(selectedController, "2y", {
    includeHealth: true,
  });
  const readings = readingsQuery.data ?? emptyReadings;
  const selectedSensors = sensors.filter(
    (sensor) => sensor.controllerId === controllerId,
  );
  const latestReadings = latestRegisterReadings(readings);
  const sensorStatusByNodeId = buildSensorStatusByNodeId(readings);
  const isLoading =
    controllersQuery.isLoading ||
    sensorsQuery.isLoading ||
    readingsQuery.isLoading;
  const isError = controllersQuery.isError || sensorsQuery.isError;

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
      <div className="flex items-end justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
            <Radio className="size-3" /> Controlador
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
              COLETA ·{" "}
              {formatPollingInterval(selectedController.pollingIntervalMs)}
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
        {readingsQuery.isError ? (
          <div className="mb-3 text-[11px] text-destructive">
            {apiErrorMessage(
              readingsQuery.error,
              "Não foi possível carregar as leituras do InfluxDB.",
            )}
          </div>
        ) : null}
        {selectedSensors.length === 0 ? (
          <RouteState message="Nenhum sensor configurado para este controlador." />
        ) : (
          <div className="space-y-3">
            {selectedSensors.map((sensor) => (
              <SensorRow
                key={sensor.id}
                sensor={sensor}
                latestReadings={latestReadings}
                status={sensorStatusByNodeId.get(sensor.nodeId) ?? "offline"}
              />
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

function SensorRow({ sensor, latestReadings, status }: SensorRowProps) {
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
            <StatusPill status={status} />
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
                reading={latestReadings.get(
                  registerReadingKey(sensor.id, register.address),
                )}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Reading({ register, reading }: ReadingProps) {
  const value = formatReadingValue(register, reading);

  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
        {register.name}
      </div>
      <div
        className={`mt-0.5 font-semibold tabular-nums text-primary ${
          value.isMissing ? "text-sm" : "text-2xl"
        }`}
      >
        {value.text}
        {value.unit ? (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {value.unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function latestRegisterReadings(
  readings: InfluxSensorReading[],
): Map<string, InfluxSensorReading> {
  const latest = new Map<string, InfluxSensorReading>();

  for (const reading of readings) {
    const key = registerReadingKey(reading.sensor_id, reading.register_address);
    const current = latest.get(key);

    if (isNewerReading(reading, current)) {
      latest.set(key, reading);
    }
  }

  return latest;
}

function buildSensorStatusByNodeId(
  readings: InfluxSensorReading[],
): Map<number, SensorStatus> {
  const latestStatusReadings = new Map<string, InfluxSensorReading>();

  for (const reading of readings) {
    if (reading.register_kind !== "health") continue;

    const key = [
      reading.node_id,
      reading.sensor_id,
      reading.register_address,
    ].join(":");
    const current = latestStatusReadings.get(key);

    if (isNewerReading(reading, current)) {
      latestStatusReadings.set(key, reading);
    }
  }

  const statusByNodeId = new Map<number, SensorStatus>();

  for (const reading of latestStatusReadings.values()) {
    const nodeId = Number(reading.node_id);

    if (!Number.isFinite(nodeId)) continue;

    if (reading.status_text === "ONLINE" || reading.online === true) {
      statusByNodeId.set(nodeId, "online");
      continue;
    }

    if (!statusByNodeId.has(nodeId)) {
      statusByNodeId.set(nodeId, "offline");
    }
  }

  return statusByNodeId;
}

function registerReadingKey(
  sensorId: string | number,
  address: string | number,
) {
  return `${sensorId}:${address}`;
}

function isNewerReading(
  reading: InfluxSensorReading,
  current: InfluxSensorReading | undefined,
): boolean {
  return !current || new Date(reading.time) > new Date(current.time);
}

function formatReadingValue(
  register: SensorRegister,
  reading: InfluxSensorReading | undefined,
): { text: string; unit: string; isMissing: boolean } {
  if (!reading) {
    return { text: "sem leitura", unit: "", isMissing: true };
  }

  if (register.isHealthCheck) {
    return {
      text: reading.status_text ?? "UNKNOWN",
      unit: "status",
      isMissing: false,
    };
  }

  const value = reading.scaled_value ?? reading.raw_value;

  return {
    text: numberFormatter.format(value),
    unit: reading.unit ?? register.unit,
    isMissing: false,
  };
}

function RouteState({ message }: RouteStateProps) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
