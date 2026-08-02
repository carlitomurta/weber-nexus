import { electricMotorMockReadings } from "../mock-data.js";
import { normalize, recommendationsForRisk, riskLevelFromScore, weightedScore } from "../scoring.js";
import type {
  EquipmentPredictionModel,
  PredictionIndicator,
  PredictionResult,
  RuntimeInferenceRequest,
  TelemetrySample,
} from "../types.js";

const ELECTRIC_MOTOR_MODEL_ID = "electric-motor-model:poc:v1";

export class ElectricMotorModel implements EquipmentPredictionModel {
  readonly id = ELECTRIC_MOTOR_MODEL_ID;
  readonly kind = "specific";

  canPredict(equipment: RuntimeInferenceRequest["equipment"]): boolean {
    return equipment.typeCode === "electric_motor";
  }

  predict(request: RuntimeInferenceRequest): PredictionResult {
    const readings = resolveReadings(request.readings, electricMotorMockReadings);
    const indicators = createElectricMotorIndicators(readings);
    const riskScore = weightedScore(indicators);
    const riskLevel = riskLevelFromScore(riskScore);

    return {
      equipmentId: request.equipment.id,
      equipmentName: request.equipment.name,
      equipmentTypeCode: request.equipment.typeCode,
      modelId: this.id,
      modelKind: this.kind,
      generatedAt: request.requestedAt ?? new Date(),
      riskScore,
      riskLevel,
      confidence: request.readings && request.readings.length > 0 ? 0.78 : 0.5,
      summary: summaryForElectricMotor(request.equipment.name, riskLevel),
      indicators,
      recommendations: recommendationsForRisk(riskLevel, "motor eletrico"),
      source: {
        kind: request.readings && request.readings.length > 0 ? "runtime" : "mock",
        sampleSize: readings.length,
      },
    };
  }
}

function createElectricMotorIndicators(
  readings: ReadonlyArray<TelemetrySample>,
): ReadonlyArray<PredictionIndicator> {
  const vibration = latestMetric(readings, "vibrationRms");
  const bearingTemperature = latestMetric(readings, "bearingTemperature");
  const currentImbalance = latestMetric(readings, "currentImbalance");
  const speedDrift = latestMetric(readings, "speedDrift");

  return [
    vibration &&
      createIndicator({
        metric: "vibrationRms",
        value: vibration.value,
        unit: vibration.unit,
        contribution: normalize(vibration.value, 3.5, 7.1) * 34,
        message: "Vibracao RMS do motor",
      }),
    bearingTemperature &&
      createIndicator({
        metric: "bearingTemperature",
        value: bearingTemperature.value,
        unit: bearingTemperature.unit,
        contribution: normalize(bearingTemperature.value, 75, 95) * 28,
        message: "Temperatura de mancal",
      }),
    currentImbalance &&
      createIndicator({
        metric: "currentImbalance",
        value: currentImbalance.value,
        unit: currentImbalance.unit,
        contribution: normalize(currentImbalance.value, 5, 12) * 24,
        message: "Desbalanceamento de corrente",
      }),
    speedDrift &&
      createIndicator({
        metric: "speedDrift",
        value: speedDrift.value,
        unit: speedDrift.unit,
        contribution: normalize(speedDrift.value, 2, 6) * 14,
        message: "Desvio de rotacao",
      }),
  ].filter(isPredictionIndicator);
}

function createIndicator(input: {
  readonly metric: string;
  readonly value: number;
  readonly unit: string;
  readonly contribution: number;
  readonly message: string;
}): PredictionIndicator {
  return {
    metric: input.metric,
    value: input.value,
    unit: input.unit,
    trend: input.contribution >= 12 ? "rising" : "stable",
    contribution: Math.round(input.contribution),
    message: input.message,
  };
}

function latestMetric(
  readings: ReadonlyArray<TelemetrySample>,
  metric: string,
): TelemetrySample | undefined {
  return readings.find((reading) => reading.metric === metric);
}

function isPredictionIndicator(
  indicator: PredictionIndicator | undefined,
): indicator is PredictionIndicator {
  return indicator !== undefined;
}

function resolveReadings(
  readings: RuntimeInferenceRequest["readings"],
  fallback: ReadonlyArray<TelemetrySample>,
): ReadonlyArray<TelemetrySample> {
  return readings && readings.length > 0 ? readings : fallback;
}

function summaryForElectricMotor(name: string, riskLevel: PredictionResult["riskLevel"]): string {
  if (riskLevel === "critical") {
    return `${name} apresenta sinais criticos de falha eletromecanica`;
  }

  if (riskLevel === "attention") {
    return `${name} apresenta degradacao inicial para acompanhamento`;
  }

  return `${name} opera dentro dos limites estimados para motor eletrico`;
}
