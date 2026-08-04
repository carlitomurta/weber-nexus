export type ConnectivityCheckInput = {
  url?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type ConnectivityCheckResult = {
  online: boolean;
  checked_at_utc: string;
  error_message: string | null;
};

export async function checkUpdateConnectivity(
  input: ConnectivityCheckInput = {},
): Promise<ConnectivityCheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? 5000,
  );

  try {
    const response = await (input.fetchImpl ?? fetch)(input.url ?? "https://api.github.com", {
      method: "HEAD",
      signal: controller.signal,
    });

    return {
      online: response.ok,
      checked_at_utc: new Date().toISOString(),
      error_message: response.ok
        ? null
        : `Verificação de conectividade retornou HTTP ${response.status}.`,
    };
  } catch (error) {
    return {
      online: false,
      checked_at_utc: new Date().toISOString(),
      error_message:
        error instanceof Error
          ? `Sem conectividade para atualização: ${error.message}`
          : "Sem conectividade para atualização.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
