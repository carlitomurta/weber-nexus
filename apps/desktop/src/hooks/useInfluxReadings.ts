import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

import type { Controller } from "../../types/controllers.type";
import type { InfluxSensorReading } from "../../types/influxdb.type";

const DEFAULT_REFETCH_INTERVAL_MS = 300000;

export function useInfluxReadings(controllers: Controller[]) {
  return useQuery({
    queryKey: ["influxdb", "readings"],
    queryFn: async () => {
      const { data } = await api.get<InfluxSensorReading[]>(
        "/influxdb/readings",
        {
          params: { limit: 300 },
        },
      );

      return data;
    },
    enabled: controllers.length > 0,
    refetchInterval: pollingRefetchInterval(controllers),
  });
}

export function pollingRefetchInterval(controllers: Controller[]): number {
  const intervals = controllers
    .map((controller) => controller.pollingIntervalMs)
    .filter((interval) => Number.isFinite(interval) && interval > 0);

  if (intervals.length === 0) return DEFAULT_REFETCH_INTERVAL_MS;
  return Math.min(...intervals);
}
