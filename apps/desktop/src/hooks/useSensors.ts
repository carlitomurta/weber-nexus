import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateSensorInput,
  Sensor,
  SensorWrite,
} from "../../types/sensors.type";

export function useSensors() {
  return useQuery({
    queryKey: ["sensors"],
    queryFn: async () => {
      const { data } = await api.get<Sensor[]>("/sensors");
      return data;
    },
  });
}

export function useCreateSensor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSensorInput) => {
      const { data } = await api.post<Sensor>("/sensors", input);
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sensors"] });
      queryClient.invalidateQueries({ queryKey: ["controllers"] });
      queryClient.invalidateQueries({ queryKey: ["influxdb", "readings"] });
    },
  });
}

export function useUpdateSensor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SensorWrite) => {
      const { data } = await api.patch<Sensor>("/sensors", input);
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sensors"] });
      queryClient.invalidateQueries({ queryKey: ["controllers"] });
      queryClient.invalidateQueries({ queryKey: ["influxdb", "readings"] });
    },
  });
}

export function useDeleteSensor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sensorId: number) => {
      const { data } = await api.delete(`/sensors/${sensorId}`);
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sensors"] });
      queryClient.invalidateQueries({ queryKey: ["controllers"] });
      queryClient.invalidateQueries({ queryKey: ["influxdb", "readings"] });
    },
  });
}
