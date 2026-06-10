import { createFileRoute } from "@tanstack/react-router";
import { Plus, Shield } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EditControllerDialog } from "@/features/controller/EditControllerDialog";
import { ControllerDetails } from "@/features/settings/ControllerDetails";
import { ControllerDialog } from "@/features/settings/ControllerDialog";
import { ControllerList } from "@/features/settings/ControllerList";
import { SensorDialog } from "@/features/settings/SensorDialog";
import { useSettingsPage } from "@/features/settings/useSettingsPage";

export const Route = createFileRoute("/_auth/settings")({
  head: () => ({ meta: [{ title: "Administração" }] }),
  component: AdminPage,
});

interface SettingsStatePanelProps {
  message: string;
}

interface SettingsQueryStateProps {
  isOffline: boolean;
  isStale: boolean;
}

function AdminPage() {
  const settings = useSettingsPage();

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-end justify-between border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
              <Shield className="size-3" /> Administração
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Cadastro de Controladores
            </h1>
            <div className="mt-1 text-sm text-muted-foreground">
              Gerencie controladores e configure os registros dos sensores
              conectados.
            </div>
          </div>
          <button
            onClick={settings.openNewControllerForm}
            className="inline-flex h-9 items-center gap-2 rounded bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> Novo controlador
          </button>
        </div>

        {settings.isLoading ? (
          <SettingsStatePanel message="Carregando configurações..." />
        ) : settings.isError ? (
          <SettingsStatePanel message="Não foi possível carregar controladores e sensores." />
        ) : (
          <>
            <SettingsQueryState
              isOffline={settings.isOffline}
              isStale={settings.isStale}
            />

            <div className="grid grid-cols-12 gap-4">
              <ControllerList
                controllers={settings.controllers}
                selectedId={settings.selectedId}
                onDeleteController={settings.setConfirm}
                onEditController={settings.setEditingControllerId}
                onSelectController={settings.setSelectedId}
              />

              <ControllerDetails
                selected={settings.selected}
                sensors={settings.selectedSensors}
                onAddSensor={settings.openNewSensorDialog}
                onDeleteSensor={settings.setConfirm}
                onEditSensor={settings.startEditSensor}
                onSyncController={settings.syncSelectedControllerXml}
                isSyncing={settings.isSyncingControllerXml}
              />
            </div>
          </>
        )}
      </div>

      {settings.isSensorDialogOpen ? (
        <SensorDialog
          key={settings.editingSensorId ?? "new-sensor"}
          title={
            settings.editingSensorId !== null ? "Editar sensor" : "Novo sensor"
          }
          draft={settings.sensorDraft}
          setDraft={settings.setSensorDraft}
          onSave={settings.saveSensor}
          onCancel={settings.closeSensorDialog}
        />
      ) : null}

      {settings.showNewController ? (
        <ControllerDialog
          title="Novo controlador"
          draft={settings.controllerDraft}
          setDraft={settings.setControllerDraft}
          onSave={settings.addController}
          onCancel={() => settings.setShowNewController(false)}
        />
      ) : null}

      {settings.editingController ? (
        <EditControllerDialog
          controller={settings.editingController}
          open={settings.editingControllerId !== null}
          onOpenChange={(open) =>
            !open && settings.setEditingControllerId(null)
          }
          onSave={settings.saveEditController}
        />
      ) : null}

      <ConfirmDialog
        open={settings.confirm !== null}
        onOpenChange={(open) => !open && settings.setConfirm(null)}
        title={
          settings.confirm?.kind === "controller"
            ? "Remover controlador?"
            : "Remover sensor?"
        }
        description={
          settings.confirm?.kind === "controller"
            ? `Esta ação remove o controlador "${settings.confirm?.name}" e todos os seus sensores. Não pode ser desfeita.`
            : `Esta ação remove o sensor "${settings.confirm?.name}" e suas configurações de registro. Não pode ser desfeita.`
        }
        confirmLabel="Remover"
        destructive
        onConfirm={settings.handleConfirm}
      />

      <ConfirmDialog
        open={settings.resetConfirm !== null}
        onOpenChange={(open) => !open && settings.setResetConfirm(null)}
        title={settings.resetConfirm?.title ?? ""}
        description={settings.resetConfirm?.description ?? ""}
        confirmLabel={settings.resetConfirm?.confirmLabel ?? "Confirmar"}
        onConfirm={settings.handleResetConfirm}
      />
    </>
  );
}

function SettingsStatePanel({ message }: SettingsStatePanelProps) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function SettingsQueryState({ isOffline, isStale }: SettingsQueryStateProps) {
  if (!isOffline && !isStale) {
    return null;
  }

  return (
    <div className="rounded border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      {isOffline
        ? "Offline: exibindo dados locais disponíveis."
        : "Dados possivelmente desatualizados."}
    </div>
  );
}
