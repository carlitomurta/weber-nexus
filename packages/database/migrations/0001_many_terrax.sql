ALTER TABLE `controllers` ADD `site` text NOT NULL;--> statement-breakpoint
ALTER TABLE `controllers` ADD `ipAddress` text NOT NULL;--> statement-breakpoint
ALTER TABLE `controllers` DROP COLUMN `is_performance`;