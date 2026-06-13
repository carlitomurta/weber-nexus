import { Field, inputCls } from "@/features/settings/form-controls";
import { useEffect, useState } from "react";
import { Save, X } from "lucide-react";
import type {
  Controller,
  ControllerWrite,
} from "../../../types/controllers.type";

type ControllerDraft = {
  name: string;
  model: string;
  site: string;
  ipAddress: string;
  pollingIntervalMs: number;
};

export function EditControllerDialog({
  controller,
  open,
  onOpenChange,
  onSave,
}: {
  controller: Controller;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (patch: ControllerWrite) => void;
}) {
  const [draft, setDraft] = useState<ControllerDraft>({
    name: "",
    model: "",
    site: "",
    ipAddress: "",
    pollingIntervalMs: 0,
  });

  useEffect(() => {
    if (controller && open) {
      setDraft({
        name: controller.name,
        model: controller.model,
        site: controller.site ?? "",
        ipAddress: controller.ipAddress,
        pollingIntervalMs: controller.pollingIntervalMs,
      });
    }
  }, [controller, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
            Editar controlador
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <Field label="Nome do controlador">
            <input
              autoFocus
              className={inputCls}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Modelo">
              <input
                className={inputCls}
                value={draft.model}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    model: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Endereço IP">
              <input
                className={inputCls + " font-mono"}
                value={draft.ipAddress}
                onChange={(e) =>
                  setDraft({ ...draft, ipAddress: e.target.value })
                }
              />
            </Field>
          </div>
          <Field label="Local / Planta">
            <input
              className={inputCls}
              value={draft.site}
              onChange={(e) => setDraft({ ...draft, site: e.target.value })}
            />
          </Field>
          <Field label="Intervalo de coleta (ms)">
            <input
              type="number"
              min={1000}
              step={1000}
              className={`${inputCls} font-mono`}
              value={draft.pollingIntervalMs}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  pollingIntervalMs: Number(e.target.value) || 0,
                })
              }
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={() => onOpenChange(false)}
            className="inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs text-muted-foreground hover:bg-muted"
          >
            <X className="size-3" /> Cancelar
          </button>
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
            onClick={() =>
              onSave({
                id: controller.id,
                port: controller.port,
                isMultihop: controller.isMultihop,
                ...draft,
              })
            }
          >
            <Save className="size-3" /> Salvar alterações
          </button>
        </div>
      </div>
    </div>
  );
}
