import type { RuntimeInferenceRequest, TelemetrySample } from "./types.js";

const MOCK_RECORDED_AT = new Date("2026-08-02T00:00:00.000Z");

export const genericMockReadings: ReadonlyArray<TelemetrySample> = [
  {
    metric: "vibrationRms",
    value: 2.2,
    unit: "mm/s",
    recordedAt: MOCK_RECORDED_AT,
    position: "principal",
  },
  {
    metric: "temperature",
    value: 54,
    unit: "C",
    recordedAt: MOCK_RECORDED_AT,
    position: "carcaca",
  },
  {
    metric: "load",
    value: 68,
    unit: "%",
    recordedAt: MOCK_RECORDED_AT,
    position: "processo",
  },
];

export const electricMotorMockReadings: ReadonlyArray<TelemetrySample> = [
  {
    metric: "vibrationRms",
    value: 4.8,
    unit: "mm/s",
    recordedAt: MOCK_RECORDED_AT,
    position: "mancal dianteiro",
    measurementAxis: "radial",
  },
  {
    metric: "bearingTemperature",
    value: 82,
    unit: "C",
    recordedAt: MOCK_RECORDED_AT,
    position: "mancal dianteiro",
  },
  {
    metric: "currentImbalance",
    value: 7.5,
    unit: "%",
    recordedAt: MOCK_RECORDED_AT,
    position: "painel",
  },
  {
    metric: "speedDrift",
    value: 3.2,
    unit: "%",
    recordedAt: MOCK_RECORDED_AT,
    position: "eixo",
  },
];

export const mockRuntimeRequests = {
  genericEquipment: {
    equipment: {
      id: "equipment-generic-001",
      name: "Equipamento generico POC",
      tag: "GEN-001",
      typeCode: "generic",
      criticality: "medium",
    },
    readings: genericMockReadings,
    requestedAt: MOCK_RECORDED_AT,
  },
  electricMotor: {
    equipment: {
      id: "equipment-motor-001",
      name: "Motor eletrico POC",
      tag: "MTR-001",
      typeCode: "electric_motor",
      manufacturer: "WEG",
      model: "W22",
      criticality: "high",
      specificAttributes: {
        ratedPowerKw: 75,
        nominalSpeedRpm: 1780,
        foundationType: "solid",
        couplingType: "flexible",
        machineClass: "class_3",
      },
    },
    readings: electricMotorMockReadings,
    requestedAt: MOCK_RECORDED_AT,
  },
} as const satisfies Record<string, RuntimeInferenceRequest>;
