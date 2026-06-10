import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

import type { Controller } from "../../types/controllers.type";
import type { InfluxSensorReading } from "../../types/influxdb.type";

const DEFAULT_REFETCH_INTERVAL_MS = 300000;

export type InfluxReadingsRange = "2y" | "1y" | "6m" | "1w";

type UseInfluxReadingsOptions = {
  includeHealth?: boolean;
};

export function useInfluxReadings(
  controller: Controller | null,
  range: InfluxReadingsRange,
  options: UseInfluxReadingsOptions = {},
) {
  const includeHealth = options.includeHealth === true;

  return useQuery({
    queryKey: [
      "influxdb",
      "readings",
      controller?.id ?? null,
      range,
      includeHealth,
    ],
    queryFn: async () => {
      const { data } = await api.get<InfluxSensorReading[]>(
        "/influxdb/readings",
        {
          params: {
            range,
            controllerId: controller?.id,
            includeHealth: includeHealth || undefined,
          },
        },
      );

      return data;
    },
    enabled: controller !== null,
    refetchInterval: controller
      ? pollingRefetchInterval([controller])
      : DEFAULT_REFETCH_INTERVAL_MS,
  });
}

export function pollingRefetchInterval(controllers: Controller[]): number {
  const intervals = controllers
    .map((controller) => controller.pollingIntervalMs)
    .filter((interval) => Number.isFinite(interval) && interval > 0);

  if (intervals.length === 0) return DEFAULT_REFETCH_INTERVAL_MS;
  return Math.min(...intervals);
}
