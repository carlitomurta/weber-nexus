import {
  AlertTriangle,
  Bug,
  ChevronDown,
  Database,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  apiErrorMessage,
  getLatestRawHoldingRegisters,
  setApiIssueReporter,
} from "@/lib/api";
import type {
  AppBuildInfo,
  DesktopDiagnostic,
  DesktopDiagnosticInput,
  DesktopDiagnosticLevel,
  DesktopDiagnosticSource,
  RawHoldingRegisterSnapshot,
} from "@/types/diagnostics.type";

const MAX_DIAGNOSTICS = 100;

export function DevelopmentDiagnostics() {
  const [buildInfo, setBuildInfo] = useState<AppBuildInfo | null>(null);
  const [diagnostics, setDiagnostics] = useState<DesktopDiagnostic[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [fatalNotice, setFatalNotice] = useState<DesktopDiagnostic | null>(
    null,
  );
  const [rawSnapshots, setRawSnapshots] = useState<
    RawHoldingRegisterSnapshot[]
  >([]);
  const [rawError, setRawError] = useState<string | null>(null);
  const [isRawLoading, setIsRawLoading] = useState(false);

  const loadRawHoldingRegisters = useCallback(async () => {
    setIsRawLoading(true);

    try {
      setRawSnapshots(await getLatestRawHoldingRegisters());
      setRawError(null);
    } catch (error) {
      setRawError(
        apiErrorMessage(
          error,
          "Não foi possível carregar registradores raw.",
        ),
      );
    } finally {
      setIsRawLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBuildInfo() {
      try {
        const info = await window.electron.app.getBuildInfo();

        if (!cancelled) {
          setBuildInfo(info);
        }
      } catch {
        if (!cancelled) {
          setBuildInfo({
            channel: import.meta.env.DEV ? "development" : "production",
            isPackaged: !import.meta.env.DEV,
            diagnosticsEnabled: import.meta.env.DEV,
          });
        }
      }
    }

    void loadBuildInfo();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!buildInfo) {
      return;
    }

    if (!window.electron?.diagnostics) {
      return;
    }

    let cancelled = false;

    const appendDiagnostic = (diagnostic: DesktopDiagnostic) => {
      if (diagnostic.audience === "operator" && diagnostic.level === "fatal") {
        setFatalNotice(diagnostic);
        return;
      }

      if (!buildInfo.diagnosticsEnabled) {
        return;
      }

      setDiagnostics((current) =>
        [diagnostic, ...current].slice(0, MAX_DIAGNOSTICS),
      );
    };

    window.electron.diagnostics
      .getRecent()
      .then((recent) => {
        if (cancelled) {
          return;
        }

        setDiagnostics(
          recent
            .filter((entry) => entry.audience === "developer")
            .slice(-MAX_DIAGNOSTICS)
            .reverse(),
        );

        setFatalNotice(lastOperatorFatal(recent));
      })
      .catch(() => undefined);

    const removeDesktopListener =
      window.electron.diagnostics.onDiagnostic(appendDiagnostic);

    if (!buildInfo.diagnosticsEnabled) {
      return () => {
        cancelled = true;
        removeDesktopListener();
      };
    }

    const reportRendererIssue = (input: DesktopDiagnosticInput) => {
      appendDiagnostic({
        ...input,
        id: `renderer-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: new Date().toISOString(),
      });
    };

    const handleWindowError = (event: ErrorEvent) => {
      reportRendererIssue({
        source: "renderer",
        level: "error",
        audience: "developer",
        message: "Erro não tratado na interface.",
        detail:
          event.error instanceof Error
            ? (event.error.stack ?? event.error.message)
            : event.message,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportRendererIssue({
        source: "renderer",
        level: "error",
        audience: "developer",
        message: "Promise rejeitada na interface.",
        detail: unknownToDetail(event.reason),
      });
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    setApiIssueReporter(reportRendererIssue);

    return () => {
      cancelled = true;
      removeDesktopListener();
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
      setApiIssueReporter(null);
    };
  }, [buildInfo]);

  useEffect(() => {
    if (!buildInfo?.diagnosticsEnabled || !isExpanded) {
      return;
    }

    void loadRawHoldingRegisters();
    const interval = window.setInterval(() => {
      void loadRawHoldingRegisters();
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [buildInfo?.diagnosticsEnabled, isExpanded, loadRawHoldingRegisters]);

  const counts = useMemo(() => {
    return diagnostics.reduce(
      (current, diagnostic) => ({
        ...current,
        [diagnostic.level]: current[diagnostic.level] + 1,
      }),
      { info: 0, warn: 0, error: 0, fatal: 0 },
    );
  }, [diagnostics]);

  if (!buildInfo) {
    return null;
  }

  if (!buildInfo.diagnosticsEnabled) {
    return fatalNotice ? (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded border border-destructive/60 bg-card p-4 text-sm shadow-2xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-foreground">{fatalNotice.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatTime(fatalNotice.timestamp)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar alerta"
            onClick={() => setFatalNotice(null)}
            className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    ) : null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(640px,calc(100vw-2rem))] text-xs">
      {isExpanded ? (
        <section className="overflow-hidden rounded border border-border bg-card shadow-2xl">
          <header className="flex h-11 items-center justify-between border-b border-border px-3">
            <div className="flex items-center gap-2">
              <Bug className="size-4 text-warning" />
              <span className="font-mono font-semibold uppercase text-foreground">
                Diagnóstico dev
              </span>
              <span className="rounded bg-muted px-2 py-0.5 font-mono text-muted-foreground">
                {diagnostics.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Limpar logs"
                title="Limpar logs"
                onClick={() => setDiagnostics([])}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Trash2 className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Recolher logs"
                title="Recolher logs"
                onClick={() => setIsExpanded(false)}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronDown className="size-4" />
              </button>
            </div>
          </header>

          <div className="grid grid-cols-4 border-b border-border text-center font-mono">
            <Counter label="INFO" value={counts.info} tone="info" />
            <Counter label="AVISO" value={counts.warn} tone="warn" />
            <Counter label="ERRO" value={counts.error} tone="error" />
            <Counter label="FATAL" value={counts.fatal} tone="fatal" />
          </div>

          <RawHoldingRegistersPanel
            snapshots={rawSnapshots}
            error={rawError}
            isLoading={isRawLoading}
            onRefresh={loadRawHoldingRegisters}
          />

          <div className="max-h-[42vh] overflow-auto">
            {diagnostics.length === 0 ? (
              <p className="px-4 py-6 text-center text-muted-foreground">
                Nenhum log técnico.
              </p>
            ) : (
              diagnostics.map((diagnostic) => (
                <article
                  key={diagnostic.id}
                  className="border-b border-border/80 px-3 py-2 last:border-0"
                >
                  <div className="flex flex-wrap items-center gap-2 font-mono">
                    <span className={levelClassName(diagnostic.level)}>
                      {levelLabel(diagnostic.level)}
                    </span>
                    <span className="text-muted-foreground">
                      {sourceLabel(diagnostic.source)}
                    </span>
                    <span className="ml-auto text-muted-foreground">
                      {formatTime(diagnostic.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 text-foreground">{diagnostic.message}</p>
                  {diagnostic.detail ? (
                    <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded bg-background/80 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {diagnostic.detail}
                    </pre>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="ml-auto flex h-10 items-center gap-2 rounded border border-border bg-card px-3 font-mono text-foreground shadow-2xl hover:bg-muted"
        >
          <Bug className="size-4 text-warning" />
          <span>REGISTROS DEV</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
            {diagnostics.length}
          </span>
        </button>
      )}
    </div>
  );
}

function RawHoldingRegistersPanel({
  snapshots,
  error,
  isLoading,
  onRefresh,
}: {
  snapshots: RawHoldingRegisterSnapshot[];
  error: string | null;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const registerCount = snapshots.reduce(
    (total, snapshot) => total + snapshot.registers.length,
    0,
  );

  return (
    <section className="border-b border-border bg-background/50">
      <header className="flex h-10 items-center justify-between border-b border-border/80 px-3">
        <div className="flex min-w-0 items-center gap-2 font-mono">
          <Database className="size-4 shrink-0 text-accent" />
          <span className="truncate font-semibold uppercase text-foreground">
            Holding bruto
          </span>
          <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
            {registerCount}
          </span>
        </div>
        <button
          type="button"
          aria-label="Atualizar registradores raw"
          title="Atualizar registradores raw"
          onClick={onRefresh}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <RefreshCw
            className={`size-4 ${isLoading ? "animate-spin" : ""}`}
          />
        </button>
      </header>

      <div className="max-h-52 overflow-auto">
        {isLoading && snapshots.length === 0 ? (
          <p className="px-4 py-5 text-center text-muted-foreground">
            Carregando registradores raw.
          </p>
        ) : error ? (
          <p className="px-4 py-5 text-center text-destructive">{error}</p>
        ) : snapshots.length === 0 ? (
          <p className="px-4 py-5 text-center text-muted-foreground">
            Nenhum dado raw coletado.
          </p>
        ) : (
          snapshots.map((snapshot) => (
            <article
              key={snapshot.controllerId}
              className="border-b border-border/70 px-3 py-2 last:border-b-0"
            >
              <div className="flex flex-wrap items-center gap-2 font-mono">
                <span className="font-semibold text-foreground">
                  {snapshot.controllerName}
                </span>
                <span className="text-muted-foreground">
                  {snapshot.ipAddress}
                </span>
                <span className="ml-auto text-muted-foreground">
                  {formatTime(snapshot.polledAt)}
                </span>
              </div>

              <table className="mt-2 w-full table-fixed border-collapse font-mono">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border/70 text-left">
                    <th className="w-16 py-1 pr-2 font-medium">Local</th>
                    <th className="w-16 py-1 pr-2 font-medium">End.</th>
                    <th className="w-20 py-1 pr-2 font-medium">Bruto</th>
                    <th className="py-1 font-medium">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.registers.map((register) => (
                    <tr
                      key={`${register.sensorId}-${register.registerAddress}`}
                      className="border-b border-border/40 last:border-b-0"
                    >
                      <td className="py-1 pr-2 text-muted-foreground">
                        {register.localRegisterNumber ?? "-"}
                      </td>
                      <td className="py-1 pr-2 text-muted-foreground">
                        {register.registerAddress}
                      </td>
                      <td className="py-1 pr-2 text-foreground">
                        {register.rawValue}
                      </td>
                      <td className="truncate py-1 text-muted-foreground">
                        {register.sensorName} / {register.registerName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: DesktopDiagnosticLevel;
}) {
  return (
    <div className="border-r border-border px-2 py-2 last:border-r-0">
      <p className={levelClassName(tone)}>{label}</p>
      <p className="mt-1 text-foreground">{value}</p>
    </div>
  );
}

function levelClassName(level: DesktopDiagnosticLevel): string {
  switch (level) {
    case "fatal":
    case "error":
      return "text-destructive";
    case "warn":
      return "text-warning";
    case "info":
      return "text-accent";
  }
}

function levelLabel(level: DesktopDiagnosticLevel): string {
  switch (level) {
    case "fatal":
      return "FATAL";
    case "error":
      return "ERRO";
    case "warn":
      return "AVISO";
    case "info":
      return "INFO";
  }
}

function sourceLabel(source: DesktopDiagnosticSource): string {
  switch (source) {
    case "api":
      return "API";
    case "desktop":
      return "Desktop";
    case "renderer":
      return "Interface";
    case "runtime":
      return "Runtime";
  }
}

function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function unknownToDetail(value: unknown): string {
  if (value instanceof Error) {
    return value.stack ?? value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function lastOperatorFatal(
  diagnostics: ReadonlyArray<DesktopDiagnostic>,
): DesktopDiagnostic | null {
  for (let index = diagnostics.length - 1; index >= 0; index -= 1) {
    const diagnostic = diagnostics[index];

    if (diagnostic.audience === "operator" && diagnostic.level === "fatal") {
      return diagnostic;
    }
  }

  return null;
}
