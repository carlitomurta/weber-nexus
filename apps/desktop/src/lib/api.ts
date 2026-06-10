import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_RUNTIME_API_URL ?? "http://localhost:3000",
});

type RuntimeErrorResponse = {
  message?: string | string[];
};

export function apiErrorMessage(
  error: unknown,
  fallback = "Não foi possível concluir a operação.",
): string {
  if (axios.isAxiosError<RuntimeErrorResponse>(error)) {
    const message = error.response?.data?.message;

    if (Array.isArray(message) && message.length > 0) {
      return message.join(", ");
    }

    if (typeof message === "string" && message.trim()) {
      return message;
    }

    if (error.message) {
      return translateHttpClientMessage(error.message);
    }
  }

  if (error instanceof Error && error.message) {
    return translateHttpClientMessage(error.message);
  }

  return fallback;
}

function translateHttpClientMessage(message: string): string {
  if (message === "Network Error") {
    return "Erro de rede. Verifique se o runtime está em execução.";
  }

  if (message.toLowerCase().includes("timeout")) {
    return "Tempo de resposta esgotado.";
  }

  return message;
}
