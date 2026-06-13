import type { ControllerDraft, SensorDraft } from "./settings.type";

export const emptyController: ControllerDraft = {
  name: "",
  model: "DXM",
  ipAddress: "",
  site: "",
  port: null,
  pollingIntervalMs: 10000,
};

export const emptySensor: SensorDraft = {
  nodeId: 1,
  name: "",
  description: "",
  location: "",
  model: "",
  registers: [],
};
