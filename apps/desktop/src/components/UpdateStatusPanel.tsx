import type { UpdateStatus } from "@/types/update.type";
import { cn } from "@/utils/classNames";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

const statusLabel: Record<UpdateStatus["status"], string> = {
  idle: "Atualizações · em dia",
  checking: "Atualizações · verificando",
  update_available: "Atualização disponível",
  downloading: "Atualização · baixando",
  downloaded: "Atualização pronta",
  ready_to_install: "Pronta para instalar",
  installing: "Atualização · instalando",
  healthy: "Atualização concluída",
  maintenance: "Runtime em manutenção",
  failed: "Atualização com falha",
};

export function UpdateStatusPanel() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    window.electron.updates
      .getStatus()
      .then((nextStatus) => {
        if (mounted) {
          setStatus(nextStatus);
        }
      })
      .catch(() => {
        if (mounted) {
          setInstallMessage("Não foi possível consultar atualizações.");
        }
      });

    const off = window.electron.updates.onStatus((nextStatus) => {
      setStatus(nextStatus);
    });

    return () => {
      mounted = false;
      off();
    };
  }, []);

  async function installUpdate() {
    setInstalling(true);
    setInstallMessage(null);

    try {
      const result = await window.electron.updates.install();
      setInstallMessage(result.message);
    } catch {
      setInstallMessage("Não foi possível solicitar a instalação.");
    } finally {
      setInstalling(false);
    }
  }

  async function refreshStatus() {
    setInstallMessage(null);

    try {
      setStatus(await window.electron.updates.getStatus());
    } catch {
      setInstallMessage("Não foi possível consultar atualizações.");
    }
  }

  if (!status) {
    return (
      <div className="px-3 py-2 rounded bg-muted/40 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-3 animate-spin" />
          Atualizações · verificando
        </span>
      </div>
    );
  }

  const attention =
    status.status === "update_available" ||
    status.status === "ready_to_install" ||
    status.status === "failed" ||
    status.status === "maintenance";

  return (
    <div
      className={cn(
        "px-3 py-2 rounded border text-[11px]",
        attention
          ? "border-warning/30 bg-warning/10"
          : "border-border bg-muted/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground">
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              attention ? "bg-warning" : "bg-success",
            )}
          />
          <span className="truncate">{statusLabel[status.status]}</span>
        </span>
        <button
          aria-label="Verificar atualizações"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
          onClick={refreshStatus}
          type="button"
        >
          <RefreshCw className="size-3" />
        </button>
      </div>

      {status.available_version ? (
        <div className="mt-1 font-mono text-[10px] text-foreground">
          v{status.available_version}
        </div>
      ) : null}

      {status.requires_action ? (
        <button
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded border border-warning/40 bg-warning/15 px-2 py-1 font-mono text-[10px] text-warning hover:bg-warning/20 disabled:opacity-60"
          disabled={installing}
          onClick={installUpdate}
          type="button"
        >
          {installing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Download className="size-3" />
          )}
          Instalar
        </button>
      ) : null}

      {installMessage ? (
        <div className="mt-2 text-[10px] text-muted-foreground">
          {installMessage}
        </div>
      ) : null}
    </div>
  );
}
