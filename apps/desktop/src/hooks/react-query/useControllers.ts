import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api";

import {
  controllerSchema,
  controllersSchema,
  type Controller,
  type ControllerWrite,
  type CreateControllerInput,
} from "../../../types/controllers.type";
import { controllerKeys, sensorKeys } from "./queryKeys";

const controllerXmlSyncResponseSchema = z.object({
  status: z.enum(["synced", "unchanged"]),
  sensorsImported: z.number(),
});

export function useControllers() {
  return useQuery({
    queryKey: controllerKeys.all,
    queryFn: async () => {
      const { data } = await api.get<unknown>("/controllers");
      return controllersSchema.parse(data);
    },
  });
}

export function useCreateController({
  onSuccess,
}: {
  onSuccess: (id: number) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateControllerInput) => {
      const { data } = await api.post<unknown>("/controllers", input);
      return controllerSchema.parse(data);
    },
    onSuccess: (data) => {
      onSuccess(data.id);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: controllerKeys.all });
      queryClient.invalidateQueries({ queryKey: sensorKeys.all });
    },
  });
}

export function useUpdateController() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ControllerWrite) => {
      const { data } = await api.patch<unknown>("/controllers", input);
      return controllerSchema.parse(data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: controllerKeys.all });
    },
  });
}

export function useSyncControllerXml() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (controllerId: number) => {
      const { data } = await api.post<unknown>(
        `/controllers/${controllerId}/xml/sync`,
      );
      return controllerXmlSyncResponseSchema.parse(data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: controllerKeys.all });
      queryClient.invalidateQueries({ queryKey: sensorKeys.all });
    },
  });
}

export function useDeleteController() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (controllerId: number) => {
      const { data } = await api.delete<unknown>(`/controllers/${controllerId}`);
      return data;
    },
    onMutate: async (controllerId: number) => {
      await queryClient.cancelQueries({ queryKey: controllerKeys.all });

      const previousControllers = queryClient.getQueryData<Controller[]>(
        controllerKeys.all,
      );

      queryClient.setQueryData<Controller[]>(controllerKeys.all, (old = []) =>
        old.filter((controller) => controller.id !== controllerId),
      );

      return { previousControllers };
    },
    onError: (_error, _controllerId, context) => {
      queryClient.setQueryData(
        controllerKeys.all,
        context?.previousControllers,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: controllerKeys.all });
    },
  });
}
