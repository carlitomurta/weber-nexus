import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shared/ui/alert-dialog";
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
};

const inputCls =
  "w-full h-9 px-2.5 rounded bg-background border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";

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
  });

  useEffect(() => {
    if (controller && open) {
      setDraft({
        name: controller.name,
        model: controller.model,
        site: controller.site,
        ipAddress: controller.ipAddress,
      });
    }
  }, [controller, open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Editar controlador</AlertDialogTitle>
          <AlertDialogDescription>
            Atualize as informações do controlador Banner DXM.
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
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              onSave({
                id: controller.id,
                port: controller.port,
                isMultihop: controller.isMultihop,
                pollingIntervalMs: controller.pollingIntervalMs,
                ...draft,
              })
            }
          >
            Salvar alterações
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[10px] font-mono tracking-[0.14em] uppercase text-muted-foreground mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}
