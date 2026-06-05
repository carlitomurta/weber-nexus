PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_controllers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`model` text NOT NULL,
	`ipAddress` text NOT NULL,
	`site` text,
	`port` integer DEFAULT 0,
	`is_multihop` integer DEFAULT false,
	`polling_interval_ms` integer DEFAULT 300000 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
INSERT INTO `__new_controllers`("id", "name", "model", "ipAddress", "site", "port", "is_multihop", "polling_interval_ms", "created_at", "updated_at") SELECT "id", "name", "model", "ipAddress", "site", "port", "is_multihop", "polling_interval_ms", "created_at", "updated_at" FROM `controllers`;--> statement-breakpoint
DROP TABLE `controllers`;--> statement-breakpoint
ALTER TABLE `__new_controllers` RENAME TO `controllers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;