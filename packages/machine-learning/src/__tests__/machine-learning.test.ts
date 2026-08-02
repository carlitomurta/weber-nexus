import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createDefaultMachineLearningEngine,
  mockRuntimeRequests,
} from "../index.js";

describe("MachineLearningEngine", () => {
  it("uses electric motor specific model for electric_motor equipment", () => {
    const engine = createDefaultMachineLearningEngine();

    const prediction = engine.predict(mockRuntimeRequests.electricMotor);

    assert.equal(prediction.modelKind, "specific");
    assert.equal(prediction.modelId, "electric-motor-model:poc:v1");
    assert.equal(prediction.equipmentTypeCode, "electric_motor");
    assert.equal(prediction.source.kind, "runtime");
    assert.ok(prediction.riskScore > 0);
  });

  it("uses generic fallback model for generic equipment", () => {
    const engine = createDefaultMachineLearningEngine();

    const prediction = engine.predict(mockRuntimeRequests.genericEquipment);

    assert.equal(prediction.modelKind, "generic");
    assert.equal(prediction.modelId, "generic-equipment-model:poc:v1");
    assert.equal(prediction.equipmentTypeCode, "generic");
  });

  it("uses mock readings when runtime request has no readings", () => {
    const engine = createDefaultMachineLearningEngine();

    const prediction = engine.predict({
      equipment: {
        id: "equipment-motor-without-readings",
        name: "Motor sem leituras",
        typeCode: "electric_motor",
      },
      requestedAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    assert.equal(prediction.modelKind, "specific");
    assert.equal(prediction.source.kind, "mock");
    assert.equal(prediction.source.sampleSize, 4);
  });
});
