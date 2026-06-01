export type SensorStatus = "online" | "warning" | "offline";

const styles: Record<SensorStatus, string> = {
  online: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  offline: "bg-destructive/15 text-destructive border-destructive/30",
};

const labels: Record<SensorStatus, string> = {
  online: "ONLINE",
  warning: "ALERTA",
  offline: "OFFLINE",
};

export function StatusPill({ status }: { status: SensorStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[10px] font-mono tracking-wider ${styles[status]}`}
    >
      <span
        className={`size-1.5 rounded-full bg-current ${status === "online" ? "animate-pulse" : ""}`}
      />
      {labels[status]}
    </span>
  );
}
