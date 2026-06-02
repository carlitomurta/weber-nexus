import { api } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type LoginResponse = {
  user: AuthUser;
};

export function useLogin() {
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const { data } = await api.post<LoginResponse>("/auth/login", input);
      return data;
    },
  });
}
