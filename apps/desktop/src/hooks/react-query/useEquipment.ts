import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

import {
  equipmentListSchema,
  equipmentSchema,
  equipmentTypesSchema,
  type CreateEquipmentInput,
  type CreateSensorInstallationInput,
  type EquipmentWrite,
} from "../../../types/equipment.type";
import { equipmentKeys, sensorKeys } from "./queryKeys";

export function useEquipmentTypes() {
  return useQuery({
    queryKey: equipmentKeys.types,
    queryFn: async () => {
      const { data } = await api.get<unknown>("/equipment-types");
      return equipmentTypesSchema.parse(data);
    },
  });
}

export function useEquipment() {
  return useQuery({
    queryKey: equipmentKeys.all,
    queryFn: async () => {
      const { data } = await api.get<unknown>("/equipment");
      return equipmentListSchema.parse(data);
    },
  });
}

export function useCreateEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateEquipmentInput) => {
      const { data } = await api.post<unknown>("/equipment", input);
      return equipmentSchema.parse(data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all });
    },
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: EquipmentWrite) => {
      const { data } = await api.patch<unknown>("/equipment", input);
      return equipmentSchema.parse(data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all });
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (equipmentId: number) => {
      const { data } = await api.delete<unknown>(`/equipment/${equipmentId}`);
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all });
    },
  });
}

export function useCreateSensorInstallation(equipmentId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSensorInstallationInput) => {
      if (equipmentId === null) {
        throw new Error("Selecione um equipamento antes de vincular sensores.");
      }

      const { data } = await api.post<unknown>(
        `/equipment/${equipmentId}/sensor-installations`,
        input,
      );
      return equipmentSchema.parse(data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all });
      queryClient.invalidateQueries({ queryKey: sensorKeys.all });
    },
  });
}

export function useEndSensorInstallation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (installationId: number) => {
      const { data } = await api.patch<unknown>(
        `/sensor-installations/${installationId}/end`,
        { endedAt: new Date().toISOString() },
      );
      return equipmentSchema.parse(data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all });
      queryClient.invalidateQueries({ queryKey: sensorKeys.all });
    },
  });
}

export function useConfirmEquipmentStandardClassification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (equipmentId: number) => {
      const { data } = await api.patch<unknown>(
        `/equipment/${equipmentId}/standard-classification/confirm`,
      );
      return equipmentSchema.parse(data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all });
    },
  });
}
