import { genericMockReadings } from "../mock-data.js";
import { normalize, recommendationsForRisk, riskLevelFromScore, weightedScore } from "../scoring.js";
import type {
  EquipmentPredictionModel,
  EquipmentProfile,
  PredictionIndicator,
  PredictionResult,
  RuntimeInferenceRequest,
  TelemetrySample,
} from "../types.js";

const GENERIC_MODEL_ID = "generic-equipment-model:poc:v1";

export class GenericEquipmentModel implements EquipmentPredictionModel {
  readonly id = GENERIC_MODEL_ID;
  readonly kind = "generic";

  canPredict(): boolean {
    return true;
  }

  predict(request: RuntimeInferenceRequest): PredictionResult {
    const readings = resolveReadings(request.readings, genericMockReadings);
    const indicators = createGenericIndicators(readings);
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
      confidence: request.readings && request.readings.length > 0 ? 0.64 : 0.42,
      summary: summaryForGenericEquipment(request.equipment, riskLevel),
      indicators,
      recommendations: recommendationsForRisk(riskLevel, "equipamento"),
      source: {
        kind: request.readings && request.readings.length > 0 ? "runtime" : "mock",
        sampleSize: readings.length,
      },
    };
  }
}

function createGenericIndicators(
  readings: ReadonlyArray<TelemetrySample>,
): ReadonlyArray<PredictionIndicator> {
  const vibration = latestMetric(readings, "vibrationRms");
  const temperature = latestMetric(readings, "temperature");
  const load = latestMetric(readings, "load");

  return [
    vibration &&
      createIndicator({
        metric: "vibrationRms",
        value: vibration.value,
        unit: vibration.unit,
        contribution: normalize(vibration.value, 3.5, 7) * 40,
        message: "Vibracao global estimada",
      }),
    temperature &&
      createIndicator({
        metric: "temperature",
        value: temperature.value,
        unit: temperature.unit,
        contribution: normalize(temperature.value, 65, 90) * 35,
        message: "Temperatura operacional estimada",
      }),
    load &&
      createIndicator({
        metric: "load",
        value: load.value,
        unit: load.unit,
        contribution: normalize(load.value, 80, 100) * 25,
        message: "Carga operacional estimada",
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
    trend: input.contribution >= 20 ? "rising" : "stable",
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

function summaryForGenericEquipment(
  equipment: EquipmentProfile,
  riskLevel: PredictionResult["riskLevel"],
): string {
  if (riskLevel === "critical") {
    return `${equipment.name} apresenta risco operacional critico na POC`;
  }

  if (riskLevel === "attention") {
    return `${equipment.name} exige acompanhamento nas proximas leituras`;
  }

  return `${equipment.name} opera dentro do padrao estimado`;
}
