CREATE TABLE IF NOT EXISTS `update_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_version` text NOT NULL,
	`to_version` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`started_at_utc` text NOT NULL,
	`finished_at_utc` text,
	`manifest_sha256` text,
	`artifact_sha256` text,
	`error_message` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `migration_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`version` text NOT NULL,
	`status` text NOT NULL,
	`started_at_utc` text NOT NULL,
	`finished_at_utc` text,
	`checksum` text,
	`error_message` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `migration_history_kind_version_idx` ON `migration_history` (`kind`,`version`);
