import {
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Settings2,
  Trash2,
} from "lucide-react";

import type { Controller } from "../../../types/controllers.type";
import type { Sensor } from "../../../types/sensors.type";
import { normalizeSensorRegister } from "./sensor-registers";
import type { DeleteConfirmation } from "./settings.type";

interface ControllerDetailsProps {
  selected: Controller | null;
  sensors: Sensor[];
  onAddSensor: () => void;
  onDeleteSensor: (confirm: DeleteConfirmation) => void;
  onEditSensor: (sensor: Sensor) => void;
  onSyncController: () => void;
  isSyncing: boolean;
}

interface SensorRowProps {
  sensor: Sensor;
  onDeleteSensor: (confirm: DeleteConfirmation) => void;
  onEditSensor: (sensor: Sensor) => void;
}

export function ControllerDetails({
  selected,
  sensors,
  onAddSensor,
  onDeleteSensor,
  onEditSensor,
  onSyncController,
  isSyncing,
}: ControllerDetailsProps) {
  if (!selected) {
    return (
      <div className="col-span-8 space-y-4">
        <div className="rounded-lg border border-dashed border-border p-16 text-center text-sm text-muted-foreground">
          Selecione ou cadastre um controlador para configurar seus sensores.
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-8 space-y-4">
      <div className="rounded-lg border border-border bg-card/60 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
              <Radio className="size-3" /> Banner {selected.model}
            </div>
            <h2 className="mt-1 text-xl font-semibold">{selected.name}</h2>
            <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
              <span>{selected.site}</span>
              <span className="font-mono">{selected.ipAddress}</span>
            </div>
          </div>
          <button
            onClick={onSyncController}
            disabled={isSyncing}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-border px-3 text-xs text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            Sincronizar
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card/60">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Settings2 className="size-3.5 text-muted-foreground" />
            <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
              Sensores e registros · {sensors.length}
            </div>
          </div>
          <button
            onClick={onAddSensor}
            className="inline-flex h-7 items-center gap-1.5 rounded bg-primary/15 px-2.5 text-xs text-primary hover:bg-primary/25"
          >
            <Plus className="size-3" /> Adicionar sensor
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
              <th className="px-4 py-2 text-left font-normal">Nome</th>
              <th className="px-4 py-2 text-left font-normal">Modelo</th>
              <th className="px-4 py-2 text-left font-normal">Localização</th>
              <th className="px-4 py-2 text-left font-normal">Node</th>
              <th className="px-4 py-2 text-left font-normal">Registros</th>
              <th className="px-4 py-2 text-right font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {sensors.map((sensor) => (
              <SensorRow
                key={sensor.id}
                sensor={sensor}
                onDeleteSensor={onDeleteSensor}
                onEditSensor={onEditSensor}
              />
            ))}

            {sensors.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-xs text-muted-foreground"
                >
                  Nenhum sensor configurado. Clique em "Adicionar sensor".
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SensorRow({ sensor, onDeleteSensor, onEditSensor }: SensorRowProps) {
  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="px-4 py-2.5">
        <div className="font-medium">{sensor.name}</div>
        <div className="text-[10px] font-mono text-muted-foreground">
          {sensor.description}
        </div>
      </td>
      <td className="px-4 py-2.5 font-mono text-xs">{sensor.model}</td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground">
        {sensor.location}
      </td>
      <td className="px-4 py-2.5 font-mono text-xs">{sensor.nodeId}</td>
      <td className="px-4 py-2.5 text-xs">
        <div className="flex flex-wrap gap-1.5">
          {sensor.registers.map((register) => {
            const normalizedRegister = normalizeSensorRegister(register);

            return (
              <span
                key={`${normalizedRegister.name}-${normalizedRegister.address}`}
                className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {normalizedRegister.name}@{normalizedRegister.address}{" "}
                {normalizedRegister.isHealthCheck
                  ? "health"
                  : formatRegisterScale(normalizedRegister)}
              </span>
            );
          })}
        </div>
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onEditSensor(sensor)}
            className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
            aria-label="Editar sensor"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={() =>
              onDeleteSensor({
                kind: "sensor",
                id: sensor.id,
                name: sensor.name,
              })
            }
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Remover sensor"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function formatRegisterScale(register: Sensor["registers"][number]): string {
  const scale =
    register.scaleType && register.scaleFactor
      ? `${register.scaleType === "divide" ? "/" : "x"}${
          register.scaleFactor
        } `
      : "";

  return `${scale}${register.unit}`;
}
