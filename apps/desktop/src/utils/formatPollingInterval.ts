export function formatPollingInterval(intervalMs: number): string {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return "-";
  }

  const seconds = Math.round(intervalMs / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes}min`;
  }

  return `${Math.round(minutes / 60)}h`;
}
