import { Save, X } from "lucide-react";

import type { Controller } from "../../../types/controllers.type";
import { Field, inputCls } from "./form-controls";
import type { ControllerDraft } from "./settings.type";

interface NewControllerFormProps {
  draft: ControllerDraft;
  setDraft: (draft: ControllerDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function NewControllerForm({
  draft,
  setDraft,
  onSave,
  onCancel,
}: NewControllerFormProps) {
  return (
    <div className="space-y-3 border-b border-border bg-muted/20 p-4">
      <Field label="Nome do controlador">
        <input
          autoFocus
          className={inputCls}
          placeholder="Ex.: Sala de Prensas Norte"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Modelo">
          <select
            className={inputCls}
            value={draft.model}
            onChange={(event) =>
              setDraft({
                ...draft,
                model: event.target.value as Controller["model"],
              })
            }
          >
            <option value="DXM700">DXM700</option>
            <option value="DXM1200">DXM1200</option>
          </select>
        </Field>
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
      </div>
      <Field label="Local / Planta">
        <input
          className={inputCls}
          placeholder="Planta A · Baia 1"
          value={draft.site}
          onChange={(event) => setDraft({ ...draft, site: event.target.value })}
        />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
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
          <Save className="size-3" /> Salvar
        </button>
      </div>
    </div>
  );
}
