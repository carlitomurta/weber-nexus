import { Save, X } from "lucide-react";

import { Field, inputCls } from "./form-controls";
import type { ControllerDraft } from "./settings.type";

interface ControllerDialogProps {
  title: string;
  draft: ControllerDraft;
  setDraft: (draft: ControllerDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function ControllerDialog({
  title,
  draft,
  setDraft,
  onSave,
  onCancel,
}: ControllerDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
            {title}
          </div>
          <button
            onClick={onCancel}
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
              placeholder="Ex.: Sala de Prensas Norte"
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Endereço IP">
              <input
                className={`${inputCls} font-mono`}
                placeholder="10.4.21.10"
                value={draft.ipAddress}
                onChange={(event) =>
                  setDraft({ ...draft, ipAddress: event.target.value })
                }
              />
            </Field>
            <Field label="Local / Planta">
              <input
                className={inputCls}
                placeholder="Planta A - Baia 1"
                value={draft.site}
                onChange={(event) =>
                  setDraft({ ...draft, site: event.target.value })
                }
              />
            </Field>
          </div>
          <Field label="Intervalo de coleta (ms)">
            <input
              type="number"
              min={1000}
              step={1000}
              className={`${inputCls} font-mono`}
              value={draft.pollingIntervalMs}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  pollingIntervalMs: Number(event.target.value) || 0,
                })
              }
            />
          </Field>
          <label className="flex h-9 items-center gap-2 rounded border border-border bg-background px-2.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={draft.isMultihop === true}
              onChange={(event) =>
                setDraft({ ...draft, isMultihop: event.target.checked })
              }
            />
            Multihop
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onCancel}
            className="inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs text-muted-foreground hover:bg-muted"
          >
            <X className="size-3" /> Cancelar
          </button>
          <button
            onClick={onSave}
            className="inline-flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
          >
            <Save className="size-3" /> Salvar controlador
          </button>
        </div>
      </div>
    </div>
  );
}
