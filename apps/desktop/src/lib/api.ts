import axios from "axios";
import {
  rawHoldingRegisterSnapshotsSchema,
  runtimeHealthResponseSchema,
  type RuntimeHealthResponse,
  type DesktopDiagnosticInput,
  type RawHoldingRegisterSnapshot,
} from "@/types/diagnostics.type";

export const api = axios.create({
  baseURL: import.meta.env.VITE_RUNTIME_API_URL ?? "http://127.0.0.1:4000",
});

let apiIssueReporter: ((diagnostic: DesktopDiagnosticInput) => void) | null =
  null;

export function setApiIssueReporter(
  reporter: ((diagnostic: DesktopDiagnosticInput) => void) | null,
) {
  apiIssueReporter = reporter;
}

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    apiIssueReporter?.({
      source: "api",
      level: "error",
      audience: "developer",
      message: "Falha na chamada da API local.",
      detail: apiDiagnosticDetail(error),
    });

    return Promise.reject(error);
  },
);

export async function getRuntimeHealth(): Promise<RuntimeHealthResponse> {
  const { data } = await api.get<unknown>("/runtime/health", {
    timeout: 1000,
  });

  return runtimeHealthResponseSchema.parse(data);
}

export async function getLatestRawHoldingRegisters(): Promise<
  RawHoldingRegisterSnapshot[]
> {
  const { data } = await api.get<unknown>(
    "/diagnostics/holding-registers/latest",
    { timeout: 1000 },
  );

  return rawHoldingRegisterSnapshotsSchema.parse(data);
}

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

function apiDiagnosticDetail(error: unknown): string {
  if (!axios.isAxiosError<RuntimeErrorResponse>(error)) {
    return error instanceof Error
      ? (error.stack ?? error.message)
      : String(error);
  }

  const method = error.config?.method?.toUpperCase() ?? "GET";
  const url = error.config?.url ?? "/";
  const status = error.response?.status ?? "sem resposta";
  const message = apiErrorMessage(error);

  return `${method} ${url} -> ${status}: ${message}`;
}
