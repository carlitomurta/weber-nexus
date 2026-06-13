import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/shared/ui/alert-dialog";
import { AlertTriangle, Check, Trash2, X } from "lucide-react";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-0 overflow-hidden rounded-lg border-border bg-card p-0 shadow-xl sm:max-w-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
            <AlertTriangle className="size-3.5" />
            Confirmação
          </div>
          <AlertDialogCancel
            className="m-0 inline-flex size-8 items-center justify-center rounded border-0 bg-transparent p-0 text-muted-foreground shadow-none hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </AlertDialogCancel>
        </div>
        <div className="space-y-2 p-4">
          <AlertDialogTitle className="text-base font-semibold tracking-tight">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-6 text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <AlertDialogCancel className="m-0 inline-flex h-8 items-center gap-1.5 rounded border-0 bg-transparent px-3 text-xs font-normal text-muted-foreground shadow-none hover:bg-muted hover:text-foreground">
            <X className="size-3" /> {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              destructive
                ? "inline-flex h-8 items-center gap-1.5 rounded bg-destructive px-3 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
                : "inline-flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            }
          >
            {destructive ? (
              <Trash2 className="size-3" />
            ) : (
              <Check className="size-3" />
            )}
            {confirmLabel}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
