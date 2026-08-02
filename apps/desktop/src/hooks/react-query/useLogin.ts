import { useMutation } from "@tanstack/react-query";

import { api } from "@/lib/api";

import {
  loginResponseSchema,
  type LoginInput,
} from "../../../types/auth.type";

export function useLogin() {
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const { data } = await api.post<unknown>("/auth/login", input);
      return loginResponseSchema.parse(data);
    },
  });
}
