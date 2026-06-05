ALTER TABLE `controllers` ADD `operational_status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `controllers` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `sensors` ADD `operational_status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `sensors` ADD `deleted_at` integer;
