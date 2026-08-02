import { ElectricMotorModel } from "./models/electric-motor.model.js";
import { GenericEquipmentModel } from "./models/generic-equipment.model.js";
import type {
  EquipmentPredictionModel,
  PredictionResult,
  RuntimeInferenceRequest,
} from "./types.js";

export interface MachineLearningEngineOptions {
  readonly models?: ReadonlyArray<EquipmentPredictionModel>;
  readonly fallbackModel?: EquipmentPredictionModel;
}

export class MachineLearningEngine {
  private readonly models: ReadonlyArray<EquipmentPredictionModel>;
  private readonly fallbackModel: EquipmentPredictionModel;

  constructor(options: MachineLearningEngineOptions = {}) {
    this.fallbackModel = options.fallbackModel ?? new GenericEquipmentModel();
    this.models = options.models ?? [
      new ElectricMotorModel(),
      this.fallbackModel,
    ];
  }

  predict(request: RuntimeInferenceRequest): PredictionResult {
    const model = this.selectModel(request);
    return model.predict(request);
  }

  selectModel(request: RuntimeInferenceRequest): EquipmentPredictionModel {
    const specificModel = this.models.find(
      (model) =>
        model.kind === "specific" && model.canPredict(request.equipment),
    );

    return specificModel ?? this.fallbackModel;
  }
}

export function createDefaultMachineLearningEngine(): MachineLearningEngine {
  return new MachineLearningEngine();
}
