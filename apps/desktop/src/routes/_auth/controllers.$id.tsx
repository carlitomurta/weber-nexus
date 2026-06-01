import { StatusPill } from "@/components/shared/StatusPill";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Radio } from "lucide-react";

export const Route = createFileRoute("/_auth/controllers/$id")({
  head: ({ params }) => ({
    meta: [{ title: `${params.id ?? "Controlador"}` }],
  }),
  component: ControllerDetail,
});

function ControllerDetail() {
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
          <div className="text-[10px] font-mono tracking-[0.2em] text-primary uppercase flex items-center gap-2">
            <Radio className="size-3" /> Banner Engineering
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">
            DXM1200
          </h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span>Planta 1</span>
            <span className="font-mono text-xs">192.168.1.1</span>
            <span className="font-mono text-xs">UPTIME · 42d 02h</span>
          </div>
        </div>
        <StatusPill status="online" />
      </div>
      <div className="grid grid-cols-4 gap-4 py-5">
        <MetaCard label="Sensores" value="16" />
        <MetaCard label="Alertas" value="4" tone="warning" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h2 className="text-sm font-semibold">Sensores conectados</h2>
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-mono tracking-[0.14em] text-muted-foreground">
              FEED AO VIVO · ultimo update 5s atrás
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <SensorRow
            sensor={{
              name: "Bomba Hidráulica 01",
              model: "QM30VT2",
              location: "Planta 1",
              readings: {
                xv: 3.2,
                zv: 10.2,
                temp: 58.4,
              },
            }}
          />
          <SensorRow
            sensor={{
              name: "Umidade do Solo 01",
              model: "M12FTH4Q",
              location: "Planta 1",
              readings: {
                moisture: 42.6,
                temp: 24.3,
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

function MetaCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div className="border border-border rounded bg-card/60 p-3">
      <div className="text-[10px] font-mono tracking-[0.16em] uppercase text-muted-foreground">
        {label}
      </div>
      <div
        className={`text-xl font-semibold mt-1 tabular-nums ${
          tone === "warning" ? "text-warning" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SensorRow({ sensor }: { sensor?: any }) {
  return (
    <div className="border border-border rounded-lg bg-card/60 overflow-hidden">
      <div className="grid grid-cols-12 gap-0">
        <div className="col-span-3 p-4 border-r border-border space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-medium text-sm">{sensor?.name}</div>
              <div className="text-[10px] font-mono tracking-[0.14em] text-muted-foreground uppercase mt-0.5">
                {sensor?.model}
              </div>
            </div>
            <StatusPill status="online" />
          </div>

          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3" /> {sensor?.location}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 col-span-3 p-4 border-r border-border space-y-3">
          {sensor?.readings?.xv !== undefined && (
            <Reading
              label="Velocidade X"
              value={sensor.readings.xv}
              unit="mm/s"
              tone="primary"
            />
          )}
          {sensor?.readings?.zv !== undefined && (
            <Reading
              label="Velocidade Z"
              value={sensor.readings.zv}
              unit="mm/s"
              tone="warning"
            />
          )}
          {sensor?.readings?.moisture !== undefined && (
            <Reading
              label="Umidade"
              value={sensor.readings.moisture}
              unit="%UR"
              tone="primary"
            />
          )}
          {sensor?.readings?.temp !== undefined && (
            <Reading
              label="Temperatura"
              value={sensor.readings.temp}
              unit="°C"
              tone={
                sensor.readings.temp <= 30
                  ? "accent"
                  : sensor.readings.temp > 30 && sensor.readings.temp <= 50
                    ? "primary"
                    : "warning"
              }
            />
          )}
        </div>

        <div className="col-span-6 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-mono tracking-[0.14em] text-muted-foreground uppercase">
              último mês
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Reading({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: number;
  unit: string;
  tone: "primary" | "accent" | "warning";
}) {
  const color = {
    primary: "text-primary",
    accent: "text-accent",
    warning: "text-warning",
  }[tone];
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className={`text-2xl font-semibold tabular-nums mt-0.5 ${color}`}>
        {value.toFixed(1)}
        <span className="text-xs text-muted-foreground ml-1 font-normal">
          {unit}
        </span>
      </div>
    </div>
  );
}
