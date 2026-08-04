export type RuntimeUpdateStatus =
  | 'idle'
  | 'maintenance'
  | 'ready_for_update'
  | 'health_check'
  | 'healthy'
  | 'failed';

export type RuntimeUpdatePreparationResult = {
  status: 'ready_for_update';
  polling_paused: true;
  pending_queue_items: number;
  prepared_at_utc: string;
  message: string;
};

export type RuntimeUpdateHealthCheck = {
  status: 'healthy' | 'maintenance' | 'failed';
  checked_at_utc: string;
  sqlite: RuntimeComponentHealth;
  influxdb: RuntimeComponentHealth;
  polling: RuntimeComponentHealth;
  api: RuntimeComponentHealth;
  message: string;
};

export type RuntimeComponentHealth = {
  status: 'healthy' | 'skipped' | 'failed';
  message: string;
};
