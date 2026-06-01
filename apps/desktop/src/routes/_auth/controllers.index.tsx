import { PageTitle } from "@/components/shared/PageTitle";
import { StatusPill, type SensorStatus } from "@/components/shared/StatusPill";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Cpu } from "lucide-react";

export const Route = createFileRoute("/_auth/controllers/")({
  head: () => ({ meta: [{ title: "Controladores" }] }),
  component: RouteComponent,
});

interface Sensor {
  id: string;
  name: string;
  status: SensorStatus;
  location: string;
  battery: number;
  lastSeen: string;
  readings: {
    velocityRms?: number;
    temperature?: number;
    humidity?: number;
  };
}

interface Controller {
  id: string;
  name: string;
  model: "DXM700" | "DXM1200";
  site: string;
  status: SensorStatus;
  uptime: string;
  ipAddress: string;
  sensors: Sensor[];
}

const controllers: Controller[] = [
  {
    id: "1",
    name: "Sala de Prensas Norte",
    model: "DXM1200",
    site: "Planta A · Baia 3",
    status: "online",
    uptime: "47d 12h",
    ipAddress: "10.4.21.11",
    sensors: [
      {
        id: "s-101",
        name: "Bomba Hidráulica 01",
        status: "online",
        location: "Carcaça do motor",
        battery: 92,
        lastSeen: "2s atrás",
        readings: { velocityRms: 3.2, temperature: 58.4 },
      },
      {
        id: "s-102",
        name: "Acionamento Esteira 02",
        status: "warning",
        location: "Caixa de engrenagens",
        battery: 71,
        lastSeen: "5s atrás",
        readings: { velocityRms: 7.8, temperature: 72.1 },
      },
      {
        id: "s-103",
        name: "Ambiente Sala de Prensas",
        status: "online",
        location: "Parede · Leste",
        battery: 88,
        lastSeen: "3s atrás",
        readings: { humidity: 42.6, temperature: 24.3 },
      },
    ],
  },
  {
    id: "2",
    name: "Linha de Montagem 2",
    model: "DXM700",
    site: "Planta A · Baia 5",
    status: "online",
    uptime: "12d 04h",
    ipAddress: "10.4.21.12",
    sensors: [
      {
        id: "s-201",
        name: "Motor de Eixo A",
        status: "online",
        location: "Lado acionado",
        battery: 95,
        lastSeen: "1s atrás",
        readings: { velocityRms: 2.1, temperature: 51.0 },
      },
      {
        id: "s-202",
        name: "Motor de Eixo B",
        status: "online",
        location: "Lado acionado",
        battery: 81,
        lastSeen: "1s atrás",
        readings: { velocityRms: 2.4, temperature: 52.7 },
      },
      {
        id: "s-203",
        name: "Sala Limpa UR",
        status: "online",
        location: "Teto",
        battery: 90,
        lastSeen: "2s atrás",
        readings: { humidity: 38.1, temperature: 21.8 },
      },
    ],
  },
  {
    id: "3",
    name: "Torre de Resfriamento",
    model: "DXM1200",
    site: "Utilidades · Telhado",
    status: "warning",
    uptime: "104d 02h",
    ipAddress: "10.4.21.13",
    sensors: [
      {
        id: "s-301",
        name: "Motor de Ventilador 01",
        status: "warning",
        location: "Mancal superior",
        battery: 64,
        lastSeen: "8s atrás",
        readings: { velocityRms: 9.2, temperature: 81.5 },
      },
      {
        id: "s-302",
        name: "Motor de Ventilador 02",
        status: "online",
        location: "Mancal superior",
        battery: 78,
        lastSeen: "4s atrás",
        readings: { velocityRms: 4.1, temperature: 63.2 },
      },
      {
        id: "s-303",
        name: "Ar Externo",
        status: "online",
        location: "Tomada de ar",
        battery: 86,
        lastSeen: "3s atrás",
        readings: { humidity: 67.4, temperature: 29.6 },
      },
    ],
  },
  {
    id: "4",
    name: "Doca de Expedição",
    model: "DXM700",
    site: "Planta B · Doca 1",
    status: "offline",
    uptime: "—",
    ipAddress: "10.4.22.20",
    sensors: [
      {
        id: "s-401",
        name: "Motor Porta da Doca",
        status: "offline",
        location: "Porta 1",
        battery: 12,
        lastSeen: "14min atrás",
        readings: { velocityRms: 0, temperature: 0 },
      },
      {
        id: "s-402",
        name: "Ambiente Armazenagem",
        status: "offline",
        location: "Corredor 4",
        battery: 8,
        lastSeen: "18min atrás",
        readings: { humidity: 0, temperature: 0 },
      },
    ],
  },
];

function RouteComponent() {
  return (
    <>
      <div className="pb-5">
        <PageTitle
          page="Planta AMBEV"
          title="Controladores"
          subtitle="4 controladores monitorados · 16 sensores ativos"
        />
      </div>
      <hr />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {controllers.map((c) => {
          const warnings = c.sensors.filter(
            (s) => s.status === "warning",
          ).length;
          const offline = c.sensors.filter(
            (s) => s.status === "offline",
          ).length;
          return (
            <Link
              key={c.id}
              to="/controllers/$id"
              params={{ id: c.id }}
              className="group border border-border rounded-lg bg-card/60 p-4 hover:border-primary/60 hover:bg-card transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-9 rounded bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Cpu className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{c.name}</div>
                    <div className="text-[10px] font-mono tracking-[0.14em] text-muted-foreground uppercase mt-0.5">
                      {c.model} · {c.ipAddress}
                    </div>
                  </div>
                </div>
                <StatusPill status={c.status} />
              </div>

              <div className="mt-3 text-xs text-muted-foreground">{c.site}</div>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <Stat label="Sensores" value={c.sensors.length} />
                <Stat
                  label="Alertas"
                  value={warnings}
                  tone={warnings ? "warning" : undefined}
                />
                <Stat
                  label="Offline"
                  value={offline}
                  tone={offline ? "destructive" : undefined}
                />
              </div>

              <div className="mt-4 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span>UPTIME · {c.uptime}</span>
                <span className="inline-flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition">
                  abrir <ChevronRight className="size-3" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning" | "destructive";
}) {
  const color =
    tone === "warning"
      ? "text-warning"
      : tone === "destructive"
        ? "text-destructive"
        : "";
  return (
    <div className="border border-border rounded bg-background/40 px-2 py-1.5">
      <div className="text-[9px] font-mono tracking-[0.14em] uppercase text-muted-foreground">
        {label}
      </div>
      <div className={`text-lg font-semibold tabular-nums ${color}`}>
        {value}
      </div>
    </div>
  );
}
