import { AlertTriangle, Bug, ChevronDown, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { setApiIssueReporter } from "@/lib/api";
import type {
  AppBuildInfo,
  DesktopDiagnostic,
  DesktopDiagnosticInput,
  DesktopDiagnosticLevel,
  DesktopDiagnosticSource,
} from "@/types/diagnostics";

const MAX_DIAGNOSTICS = 100;

export function DevelopmentDiagnostics() {
  const [buildInfo, setBuildInfo] = useState<AppBuildInfo | null>(null);
  const [diagnostics, setDiagnostics] = useState<DesktopDiagnostic[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [fatalNotice, setFatalNotice] = useState<DesktopDiagnostic | null>(
    null,
  );

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
