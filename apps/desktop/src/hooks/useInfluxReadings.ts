import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

import type { Controller } from "../../types/controllers.type";
import type { InfluxSensorReading } from "../../types/influxdb.type";

const DEFAULT_REFETCH_INTERVAL_MS = 300000;

export type InfluxReadingsRange = "2y" | "6m" | "1w";

export function useInfluxReadings(
  controllers: Controller[],
  range: InfluxReadingsRange,
) {
  return useQuery({
    queryKey: ["influxdb", "readings", range],
    queryFn: async () => {
      const { data } = await api.get<InfluxSensorReading[]>(
        "/influxdb/readings",
        { params: { range } },
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
