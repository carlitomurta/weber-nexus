import { Cpu, Pencil, Trash2 } from "lucide-react";
import type { Controller } from "../../../types/controllers.type";
import { NewControllerForm } from "./NewControllerForm";
import type { ControllerDraft, DeleteConfirmation } from "./types";

export function ControllerList({
  controllers,
  draft,
  selectedId,
  showNewController,
  onCancelNewController,
  onDeleteController,
  onEditController,
  onSaveNewController,
  onSelectController,
  setDraft,
}: {
  controllers: Controller[];
  draft: ControllerDraft;
  selectedId: number | null;
  showNewController: boolean;
  onCancelNewController: () => void;
  onDeleteController: (confirm: DeleteConfirmation) => void;
  onEditController: (controllerId: number) => void;
  onSaveNewController: () => void;
  onSelectController: (controllerId: number) => void;
  setDraft: (draft: ControllerDraft) => void;
}) {
  return (
    <div className="col-span-4 overflow-hidden rounded-lg border border-border bg-card/60">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
          Controladores · {controllers.length}
        </div>
        <Cpu className="size-3.5 text-muted-foreground" />
      </div>

      {showNewController ? (
        <NewControllerForm
          draft={draft}
          setDraft={setDraft}
          onSave={onSaveNewController}
          onCancel={onCancelNewController}
        />
      ) : null}

      <ul className="divide-y divide-border">
        {controllers.map((controller) => {
          const active = controller.id === selectedId;

          return (
            <li
              key={controller.id}
              className={`cursor-pointer px-4 py-3 transition-colors ${
                active
                  ? "border-l-2 border-primary bg-primary/10"
                  : "hover:bg-muted/40"
              }`}
              onClick={() => onSelectController(controller.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {controller.name}
                  </div>
                  <div className="truncate text-[11px] font-mono text-muted-foreground">
                    {controller.model} · {controller.ipAddress}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onEditController(controller.id);
                    }}
                    className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    aria-label="Editar"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteController({
                        kind: "controller",
                        id: controller.id,
                        name: controller.name,
                      });
                    }}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}

        {controllers.length === 0 ? (
          <li className="px-4 py-8 text-center text-xs text-muted-foreground">
            Nenhum controlador cadastrado.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
