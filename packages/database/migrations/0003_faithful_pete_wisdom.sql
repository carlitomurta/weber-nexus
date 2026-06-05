ALTER TABLE `sensors` ADD `description` text;--> statement-breakpoint
ALTER TABLE `sensors` ADD `model` text;--> statement-breakpoint
ALTER TABLE `sensors` ADD `location` text;--> statement-breakpoint
ALTER TABLE `sensors` ADD `registers` text DEFAULT '[]' NOT NULL;