import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Sensor } from "../../types/sensors.type";

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
    mutationFn: async (input: Omit<Sensor, "id">) => {
      const { data } = await api.post<Sensor>("/sensors", input);
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sensors"] });
    },
  });
}

export function useUpdateSensor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Sensor) => {
      const { data } = await api.patch<Sensor>("/sensors", input);
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sensors"] });
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
    },
  });
}
