export type SensorType = "QM30VT2" | "QM30VT3" | "M12FTH4Q";
export type SensorStatus = "online" | "warning" | "offline";

export interface Sensor {
  id: string;
  name: string;
  type: SensorType;
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

export interface Controller {
  id: string;
  name: string;
  model: "DXM700" | "DXM1200";
  site: string;
  status: SensorStatus;
  uptime: string;
  ipAddress: string;
  sensors: Sensor[];
}

const sensorTypeMeta: Record<
  SensorType,
  { label: string; unit: string; metric: string }
> = {
  QM30VT2: {
    label: "Vibração + Temperatura",
    unit: "mm/s",
    metric: "Velocidade RMS",
  },
  QM30VT3: {
    label: "Vibração + Temp (Alta Res.)",
    unit: "mm/s",
    metric: "Velocidade RMS",
  },
  M12FTH4Q: { label: "Umidade + Temperatura", unit: "%UR", metric: "Umidade" },
};

export const getSensorMeta = (t: SensorType) => sensorTypeMeta[t];

export const controllers: Controller[] = [
  {
    id: "dxm-001",
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
        type: "QM30VT2",
        status: "online",
        location: "Carcaça do motor",
        battery: 92,
        lastSeen: "2s atrás",
        readings: { velocityRms: 3.2, temperature: 58.4 },
      },
      {
        id: "s-102",
        name: "Acionamento Esteira 02",
        type: "QM30VT3",
        status: "warning",
        location: "Caixa de engrenagens",
        battery: 71,
        lastSeen: "5s atrás",
        readings: { velocityRms: 7.8, temperature: 72.1 },
      },
      {
        id: "s-103",
        name: "Ambiente Sala de Prensas",
        type: "M12FTH4Q",
        status: "online",
        location: "Parede · Leste",
        battery: 88,
        lastSeen: "3s atrás",
        readings: { humidity: 42.6, temperature: 24.3 },
      },
    ],
  },
  {
    id: "dxm-002",
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
        type: "QM30VT2",
        status: "online",
        location: "Lado acionado",
        battery: 95,
        lastSeen: "1s atrás",
        readings: { velocityRms: 2.1, temperature: 51.0 },
      },
      {
        id: "s-202",
        name: "Motor de Eixo B",
        type: "QM30VT2",
        status: "online",
        location: "Lado acionado",
        battery: 81,
        lastSeen: "1s atrás",
        readings: { velocityRms: 2.4, temperature: 52.7 },
      },
      {
        id: "s-203",
        name: "Sala Limpa UR",
        type: "M12FTH4Q",
        status: "online",
        location: "Teto",
        battery: 90,
        lastSeen: "2s atrás",
        readings: { humidity: 38.1, temperature: 21.8 },
      },
    ],
  },
  {
    id: "dxm-003",
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
        type: "QM30VT3",
        status: "warning",
        location: "Mancal superior",
        battery: 64,
        lastSeen: "8s atrás",
        readings: { velocityRms: 9.2, temperature: 81.5 },
      },
      {
        id: "s-302",
        name: "Motor de Ventilador 02",
        type: "QM30VT3",
        status: "online",
        location: "Mancal superior",
        battery: 78,
        lastSeen: "4s atrás",
        readings: { velocityRms: 4.1, temperature: 63.2 },
      },
      {
        id: "s-303",
        name: "Ar Externo",
        type: "M12FTH4Q",
        status: "online",
        location: "Tomada de ar",
        battery: 86,
        lastSeen: "3s atrás",
        readings: { humidity: 67.4, temperature: 29.6 },
      },
    ],
  },
  {
    id: "dxm-004",
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
        type: "QM30VT2",
        status: "offline",
        location: "Porta 1",
        battery: 12,
        lastSeen: "14min atrás",
        readings: { velocityRms: 0, temperature: 0 },
      },
      {
        id: "s-402",
        name: "Ambiente Armazenagem",
        type: "M12FTH4Q",
        status: "offline",
        location: "Corredor 4",
        battery: 8,
        lastSeen: "18min atrás",
        readings: { humidity: 0, temperature: 0 },
      },
    ],
  },
];

export const getController = (id: string) =>
  controllers.find((c) => c.id === id);

// Deterministic seeded pseudo-random for SSR-safe series
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSeries(
  base: number,
  points = 48,
  jitter = 0.15,
  seed = 42,
) {
  const rand = mulberry32(Math.floor(base * 1000) + points + seed);
  return Array.from({ length: points }, (_, i) => {
    const noise = (Math.sin(i / 3) + Math.cos(i / 5)) * jitter * base;
    const drift = (rand() - 0.5) * jitter * base * 0.5;
    return {
      t: i,
      time: `${i + 1}`,
      value: Math.max(0, +(base + noise + drift).toFixed(2)),
    };
  });
}

export interface Alert {
  id: string;
  controllerId: string;
  controllerName: string;
  sensorId: string;
  sensorName: string;
  sensorType: SensorType;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  value: string;
  threshold: string;
  triggeredAt: string;
}

export const alerts: Alert[] = [
  {
    id: "a-001",
    controllerId: "dxm-003",
    controllerName: "Torre de Resfriamento",
    sensorId: "s-301",
    sensorName: "Motor de Ventilador 01",
    sensorType: "QM30VT3",
    severity: "critical",
    title: "Vibração acima do limite crítico",
    description:
      "Velocidade RMS sustentada acima de 9,0 mm/s nas últimas 12 horas. Sugere desbalanceamento ou desgaste de mancal.",
    value: "9,2 mm/s",
    threshold: "> 9,0 mm/s",
    triggeredAt: "há 14min",
  },
  {
    id: "a-002",
    controllerId: "dxm-001",
    controllerName: "Sala de Prensas Norte",
    sensorId: "s-102",
    sensorName: "Acionamento Esteira 02",
    sensorType: "QM30VT3",
    severity: "warning",
    title: "Temperatura elevada na caixa de engrenagens",
    description:
      "Temperatura acima da faixa nominal. Verificar lubrificação e ventilação.",
    value: "72,1 °C",
    threshold: "> 70,0 °C",
    triggeredAt: "há 38min",
  },
  {
    id: "a-003",
    controllerId: "dxm-004",
    controllerName: "Doca de Expedição",
    sensorId: "s-401",
    sensorName: "Motor Porta da Doca",
    sensorType: "QM30VT2",
    severity: "critical",
    title: "Sensor offline",
    description:
      "Sem comunicação com o sensor há mais de 14 minutos. Bateria crítica registrada antes da perda.",
    value: "Offline",
    threshold: "Bateria 12%",
    triggeredAt: "há 14min",
  },
  {
    id: "a-004",
    controllerId: "dxm-004",
    controllerName: "Doca de Expedição",
    sensorId: "s-402",
    sensorName: "Ambiente Armazenagem",
    sensorType: "M12FTH4Q",
    severity: "critical",
    title: "Sensor offline",
    description: "Sem comunicação com o sensor há mais de 18 minutos.",
    value: "Offline",
    threshold: "Bateria 8%",
    triggeredAt: "há 18min",
  },
  {
    id: "a-005",
    controllerId: "dxm-003",
    controllerName: "Torre de Resfriamento",
    sensorId: "s-303",
    sensorName: "Ar Externo",
    sensorType: "M12FTH4Q",
    severity: "info",
    title: "Umidade externa elevada",
    description:
      "Umidade relativa acima de 65% pode afetar eficiência de troca térmica da torre.",
    value: "67,4 %UR",
    threshold: "> 65 %UR",
    triggeredAt: "há 1h",
  },
];

export const stats = {
  controllers: controllers.length,
  sensors: controllers.reduce((n, c) => n + c.sensors.length, 0),
  online: controllers.filter((c) => c.status === "online").length,
  alerts: alerts.length,
  critical: alerts.filter((a) => a.severity === "critical").length,
};
