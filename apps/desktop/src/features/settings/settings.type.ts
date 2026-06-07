import type { CreateControllerInput } from "../../../types/controllers.type";
import type { CreateSensorInput } from "../../../types/sensors.type";

export type ControllerDraft = CreateControllerInput;
export type SensorDraft = Omit<CreateSensorInput, "controllerId">;

export type DeleteConfirmation =
  | { kind: "controller"; id: number; name: string }
  | { kind: "sensor"; id: number; name: string };
