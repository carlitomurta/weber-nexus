import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Controller,
  ControllerWrite,
  CreateControllerInput,
} from "../../types/controllers.type";

export function useControllers() {
  return useQuery({
    queryKey: ["controllers"],
    queryFn: async () => {
      const { data } = await api.get<Controller[]>("/controllers");
      return data;
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
      const { data } = await api.post<Controller>("/controllers", input);
      return data;
    },
    onMutate: async (newController) => {
      await queryClient.cancelQueries({ queryKey: ["controllers"] });

      const previousTodos = queryClient.getQueryData(["controllers"]);

      queryClient.setQueryData(["controllers"], (old: Controller[] = []) => [
        ...old,
        newController as Controller,
      ]);

      return { previousTodos };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(["controllers"], context?.previousTodos);
    },
    onSuccess: (data) => {
      onSuccess(data.id);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["controllers"] });
    },
  });
}

export function useUpdateController() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ControllerWrite) => {
      const { data } = await api.patch<Controller>("/controllers", input);
      return data;
    },
    onMutate: async (newController) => {
      await queryClient.cancelQueries({ queryKey: ["controllers"] });

      const previousTodos = queryClient.getQueryData(["controllers"]);

      queryClient.setQueryData(["controllers"], (old: Controller[]) =>
        old.map((controller) =>
          controller.id === newController.id
            ? { ...controller, ...newController }
            : controller,
        ),
      );

      return { previousTodos };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(["controllers"], context?.previousTodos);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["controllers"] });
    },
  });
}

export function useDeleteController() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (controllerId: number) => {
      const { data } = await api.delete(`/controllers/${controllerId}`);
      return data;
    },
    onMutate: async (controllerId: number) => {
      await queryClient.cancelQueries({ queryKey: ["controllers"] });

      const previousTodos = queryClient.getQueryData(["controllers"]);

      queryClient.setQueryData(["controllers"], (old: Controller[]) =>
        old.filter((controller) => controller.id !== controllerId),
      );

      return { previousTodos };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(["controllers"], context?.previousTodos);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["controllers"] });
    },
  });
}
