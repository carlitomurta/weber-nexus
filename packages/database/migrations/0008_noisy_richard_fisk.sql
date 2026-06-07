CREATE TABLE `influx_write_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`line_protocol` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`last_attempt_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000)
);
