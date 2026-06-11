import { type ReactNode, useEffect, useState } from "react";

import { AppLogo } from "@/components/shared/AppLogo";
import { apiErrorMessage, getRuntimeHealth } from "@/lib/api";

const RETRY_DELAY_MS = 800;
const SLOW_START_DELAY_MS = 8000;

type RuntimeAvailabilityGateProps = {
  children: ReactNode;
};

export function RuntimeAvailabilityGate({
  children,
}: RuntimeAvailabilityGateProps) {
  const [isReady, setIsReady] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;

    const slowStartTimeout = setTimeout(() => {
      if (!cancelled) {
        setShowRetry(true);
      }
    }, SLOW_START_DELAY_MS);

    async function checkRuntimeAvailability() {
      try {
        await getRuntimeHealth();

        if (!cancelled) {
          setIsReady(true);
          setLastError(null);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLastError(
          apiErrorMessage(error, "Runtime local ainda indisponível."),
        );
        retryTimeout = setTimeout(
          checkRuntimeAvailability,
          RETRY_DELAY_MS,
        );
      }
    }

    void checkRuntimeAvailability();

    return () => {
      cancelled = true;
      clearTimeout(slowStartTimeout);

      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [retryKey]);

  if (isReady) {
    return children;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-border rounded-lg bg-card/75 p-8 shadow-2xl backdrop-blur">
        <div className="flex justify-center">
          <AppLogo />
        </div>

        <div className="mt-8 flex justify-center">
          <div className="relative size-16">
            <span className="absolute inset-0 rounded-full border border-primary/30" />
            <span className="absolute inset-2 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_20px_var(--color-primary)]" />
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-primary">
            Runtime local
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            Iniciando runtime...
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Preparando serviços locais para autenticação e coleta de dados.
          </p>
        </div>

        {showRetry ? (
          <div className="mt-6 rounded border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-muted-foreground">
            <p>
              {lastError ??
                "O runtime ainda não respondeu. A verificação continua em segundo plano."}
            </p>
            <button
              type="button"
              onClick={() => {
                setShowRetry(false);
                setLastError(null);
                setRetryKey((current) => current + 1);
              }}
              className="mt-3 inline-flex h-9 items-center justify-center rounded border border-input bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
