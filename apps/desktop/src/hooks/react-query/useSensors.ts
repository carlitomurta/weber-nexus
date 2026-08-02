import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

import {
  sensorSchema,
  sensorsSchema,
  type CreateSensorInput,
  type SensorWrite,
} from "../../../types/sensors.type";
import { controllerKeys, influxReadingKeys, sensorKeys } from "./queryKeys";

export function useSensors() {
  return useQuery({
    queryKey: sensorKeys.all,
    queryFn: async () => {
      const { data } = await api.get<unknown>("/sensors");
      return sensorsSchema.parse(data);
    },
  });
}

export function useCreateSensor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSensorInput) => {
      const { data } = await api.post<unknown>("/sensors", input);
      return sensorSchema.parse(data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sensorKeys.all });
      queryClient.invalidateQueries({ queryKey: controllerKeys.all });
      queryClient.invalidateQueries({ queryKey: influxReadingKeys.all });
    },
  });
}

export function useUpdateSensor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SensorWrite) => {
      const { data } = await api.patch<unknown>("/sensors", input);
      return sensorSchema.parse(data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sensorKeys.all });
      queryClient.invalidateQueries({ queryKey: controllerKeys.all });
      queryClient.invalidateQueries({ queryKey: influxReadingKeys.all });
    },
  });
}

export function useDeleteSensor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sensorId: number) => {
      const { data } = await api.delete<unknown>(`/sensors/${sensorId}`);
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sensorKeys.all });
      queryClient.invalidateQueries({ queryKey: controllerKeys.all });
      queryClient.invalidateQueries({ queryKey: influxReadingKeys.all });
    },
  });
}
