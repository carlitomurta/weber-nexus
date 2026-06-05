CREATE TABLE `controllers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`model` text NOT NULL,
	`port` integer DEFAULT 0 NOT NULL,
	`is_performance` integer DEFAULT false,
	`is_multihop` integer DEFAULT false,
	`polling_interval_ms` integer DEFAULT 300000 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE TABLE `influx_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`host` text NOT NULL,
	`bucket` text NOT NULL,
	`token` text NOT NULL,
	`org` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE TABLE `sensors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`controller_id` integer NOT NULL,
	`name` text NOT NULL,
	`modbus_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`controller_id`) REFERENCES `controllers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);