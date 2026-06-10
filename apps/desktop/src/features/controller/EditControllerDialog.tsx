import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shared/ui/alert-dialog";
import { Field, inputCls } from "@/features/settings/form-controls";
import { useEffect, useState } from "react";
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
        site: controller.site,
        ipAddress: controller.ipAddress,
        pollingIntervalMs: controller.pollingIntervalMs,
      });
    }
  }, [controller, open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Editar controlador</AlertDialogTitle>
          <AlertDialogDescription>
            Atualize as informações do controlador.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <Field label="Nome do controlador">
            <input
              className={inputCls}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Modelo">
              <select
                className={inputCls}
                value={draft.model}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    model: e.target.value,
                  })
                }
              >
                <option value="DXM700">DXM700</option>
                <option value="DXM1200">DXM1200</option>
              </select>
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
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <button
            className="inline-flex h-9 items-center justify-center rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() =>
              onSave({
                id: controller.id,
                port: controller.port,
                isMultihop: controller.isMultihop,
                ...draft,
              })
            }
          >
            Salvar alterações
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
