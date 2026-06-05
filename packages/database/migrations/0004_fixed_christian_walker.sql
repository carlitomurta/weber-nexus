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
	`created_at` integer DEFAULT '"2026-06-04T23:48:23.500Z"',
	`updated_at` integer DEFAULT '"2026-06-04T23:48:23.500Z"'
);
--> statement-breakpoint
INSERT INTO `__new_controllers`("id", "name", "model", "ipAddress", "site", "port", "is_multihop", "polling_interval_ms", "created_at", "updated_at") SELECT "id", "name", "model", "ipAddress", "site", "port", "is_multihop", "polling_interval_ms", "created_at", "updated_at" FROM `controllers`;--> statement-breakpoint
DROP TABLE `controllers`;--> statement-breakpoint
ALTER TABLE `__new_controllers` RENAME TO `controllers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_influx_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`host` text NOT NULL,
	`bucket` text NOT NULL,
	`token` text NOT NULL,
	`org` text NOT NULL,
	`created_at` integer DEFAULT '"2026-06-04T23:48:23.500Z"',
	`updated_at` integer DEFAULT '"2026-06-04T23:48:23.500Z"'
);
--> statement-breakpoint
INSERT INTO `__new_influx_configs`("id", "host", "bucket", "token", "org", "created_at", "updated_at") SELECT "id", "host", "bucket", "token", "org", "created_at", "updated_at" FROM `influx_configs`;--> statement-breakpoint
DROP TABLE `influx_configs`;--> statement-breakpoint
ALTER TABLE `__new_influx_configs` RENAME TO `influx_configs`;--> statement-breakpoint
CREATE TABLE `__new_sensors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`controller_id` integer NOT NULL,
	`modbus_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`model` text,
	`location` text,
	`registers` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT '"2026-06-04T23:48:23.500Z"',
	`updated_at` integer DEFAULT '"2026-06-04T23:48:23.500Z"',
	FOREIGN KEY (`controller_id`) REFERENCES `controllers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sensors`("id", "controller_id", "modbus_id", "name", "description", "model", "location", "registers", "created_at", "updated_at") SELECT "id", "controller_id", "modbus_id", "name", "description", "model", "location", "registers", "created_at", "updated_at" FROM `sensors`;--> statement-breakpoint
DROP TABLE `sensors`;--> statement-breakpoint
ALTER TABLE `__new_sensors` RENAME TO `sensors`;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT '"2026-06-04T23:48:23.500Z"',
	`updated_at` integer DEFAULT '"2026-06-04T23:48:23.500Z"'
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "name", "email", "password_hash", "role", "created_at", "updated_at") SELECT "id", "name", "email", "password_hash", "role", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);