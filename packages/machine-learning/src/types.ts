export type EquipmentTypeCode = "generic" | "electric_motor" | (string & {});

export type EquipmentCriticality = "low" | "medium" | "high" | "critical";

export type ModelKind = "generic" | "specific";

export type RiskLevel = "normal" | "attention" | "critical";

export type MeasurementTrend = "stable" | "rising" | "falling";

export type RecommendationSeverity = "info" | "warning" | "urgent";

export type EquipmentSpecificAttributes = Record<
  string,
  string | number | boolean | null
>;

export interface EquipmentProfile {
  readonly id: string;
  readonly name: string;
  readonly tag?: string;
  readonly typeCode: EquipmentTypeCode;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly criticality?: EquipmentCriticality;
  readonly specificAttributes?: EquipmentSpecificAttributes;
}

export interface TelemetrySample {
  readonly metric: string;
  readonly value: number;
  readonly unit: string;
  readonly recordedAt: Date;
  readonly sensorId?: string;
  readonly position?: string;
  readonly measurementAxis?: string;
}

export interface RuntimeInferenceRequest {
  readonly equipment: EquipmentProfile;
  readonly readings?: ReadonlyArray<TelemetrySample>;
  readonly requestedAt?: Date;
}

export interface PredictionIndicator {
  readonly metric: string;
  readonly value: number;
  readonly unit: string;
  readonly trend: MeasurementTrend;
  readonly contribution: number;
  readonly message: string;
}

export interface PredictionRecommendation {
  readonly code: string;
  readonly severity: RecommendationSeverity;
  readonly message: string;
}

export interface PredictionSource {
  readonly kind: "mock" | "runtime";
  readonly sampleSize: number;
}

export interface PredictionResult {
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly equipmentTypeCode: EquipmentTypeCode;
  readonly modelId: string;
  readonly modelKind: ModelKind;
  readonly generatedAt: Date;
  readonly riskScore: number;
  readonly riskLevel: RiskLevel;
  readonly confidence: number;
  readonly summary: string;
  readonly indicators: ReadonlyArray<PredictionIndicator>;
  readonly recommendations: ReadonlyArray<PredictionRecommendation>;
  readonly source: PredictionSource;
}

export interface EquipmentPredictionModel {
  readonly id: string;
  readonly kind: ModelKind;
  canPredict(equipment: EquipmentProfile): boolean;
  predict(request: RuntimeInferenceRequest): PredictionResult;
}
