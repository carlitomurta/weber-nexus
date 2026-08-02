export const controllerKeys = {
  all: ["controllers"] as const,
};

export const sensorKeys = {
  all: ["sensors"] as const,
};

export const equipmentKeys = {
  all: ["equipment"] as const,
  types: ["equipment-types"] as const,
};

export const influxReadingKeys = {
  all: ["influxdb", "readings"] as const,
  byController: (
    controllerId: number | null,
    range: string,
    includeHealth: boolean,
  ) => [...influxReadingKeys.all, controllerId, range, includeHealth] as const,
};
