import type {
  PredictionIndicator,
  PredictionRecommendation,
  RiskLevel,
} from "./types.js";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalize(value: number, warning: number, critical: number): number {
  if (critical <= warning) return 0;
  return clamp((value - warning) / (critical - warning), 0, 1);
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 45) return "attention";
  return "normal";
}

export function weightedScore(
  indicators: ReadonlyArray<PredictionIndicator>,
): number {
  if (indicators.length === 0) return 0;

  const contribution = indicators.reduce(
    (total, indicator) => total + indicator.contribution,
    0,
  );

  return Math.round(clamp(contribution, 0, 100));
}

export function recommendationsForRisk(
  riskLevel: RiskLevel,
  context: string,
): ReadonlyArray<PredictionRecommendation> {
  if (riskLevel === "critical") {
    return [
      {
        code: "inspect-equipment",
        severity: "urgent",
        message: `Inspecionar ${context} antes do proximo ciclo operacional`,
      },
      {
        code: "confirm-sensors",
        severity: "warning",
        message: "Validar fixacao dos sensores e repetir coleta",
      },
    ];
  }

  if (riskLevel === "attention") {
    return [
      {
        code: "monitor-trend",
        severity: "warning",
        message: `Monitorar tendencia de ${context} nas proximas leituras`,
      },
    ];
  }

  return [
    {
      code: "keep-monitoring",
      severity: "info",
      message: "Manter monitoramento regular",
    },
  ];
}
