CREATE TABLE `equipment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`equipment_type_id` integer NOT NULL,
	`name` text NOT NULL,
	`tag` text NOT NULL,
	`manufacturer` text,
	`model` text,
	`serial_number` text,
	`site` text,
	`area` text,
	`location` text,
	`criticality` text DEFAULT 'medium' NOT NULL,
	`operational_status` text DEFAULT 'active' NOT NULL,
	`specific_attributes` text DEFAULT '{}' NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`equipment_type_id`) REFERENCES `equipment_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `equipment_standard_classifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`equipment_id` integer NOT NULL,
	`standard_id` integer NOT NULL,
	`status` text DEFAULT 'suggested' NOT NULL,
	`source` text DEFAULT 'rule' NOT NULL,
	`explanation` text NOT NULL,
	`rule_version` integer DEFAULT 1 NOT NULL,
	`classified_at` integer NOT NULL,
	`confirmed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`standard_id`) REFERENCES `standards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipment_standard_active_idx` ON `equipment_standard_classifications` (`equipment_id`) WHERE status IN ('suggested', 'confirmed');--> statement-breakpoint
CREATE TABLE `equipment_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`version` integer DEFAULT 1 NOT NULL,
	`field_definitions` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipment_types_code_unique` ON `equipment_types` (`code`);--> statement-breakpoint
CREATE TABLE `sensor_installations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`equipment_id` integer NOT NULL,
	`sensor_id` integer NOT NULL,
	`installed_at` integer NOT NULL,
	`ended_at` integer,
	`position` text,
	`measurement_axis` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sensor_id`) REFERENCES `sensors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sensor_installations_active_sensor_idx` ON `sensor_installations` (`sensor_id`) WHERE ended_at IS NULL;--> statement-breakpoint
CREATE TABLE `standards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`family` text NOT NULL,
	`status` text NOT NULL,
	`scope` text,
	`version` integer DEFAULT 1 NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `standards_code_unique` ON `standards` (`code`);--> statement-breakpoint
INSERT INTO `equipment_types` (`code`, `name`, `description`, `version`, `field_definitions`, `active`) VALUES
('generic', 'Genérico', 'Equipamento industrial sem campos específicos iniciais.', 1, '[]', true),
('electric_motor', 'Motor elétrico', 'Motor elétrico monitorado por sensores industriais.', 1, '[{"key":"ratedPowerKw","label":"Potência nominal","type":"number","unit":"kW","required":true},{"key":"nominalSpeedRpm","label":"Rotação nominal","type":"number","unit":"rpm","required":true},{"key":"foundationType","label":"Fundação","type":"select","required":true,"options":[{"label":"Sólida / rígida","value":"solid"},{"label":"Flexível","value":"flexible"}]},{"key":"couplingType","label":"Acoplamento","type":"select","required":true,"options":[{"label":"Flexível","value":"flexible"},{"label":"Rígido","value":"rigid"},{"label":"Direto","value":"direct"}]},{"key":"machineClass","label":"Classe do equipamento","type":"select","options":[{"label":"Classe 1","value":"class_1"},{"label":"Classe 2","value":"class_2"},{"label":"Classe 3","value":"class_3"},{"label":"Classe 4","value":"class_4"}]}]', true),
('pump', 'Bomba', 'Bomba industrial acoplada ou monitorada individualmente.', 1, '[{"key":"ratedPowerKw","label":"Potência nominal","type":"number","unit":"kW"},{"key":"nominalSpeedRpm","label":"Rotação nominal","type":"number","unit":"rpm"},{"key":"pumpType","label":"Tipo de bomba","type":"select","required":true,"options":[{"label":"Centrífuga","value":"centrifugal"},{"label":"Deslocamento positivo","value":"positive_displacement"},{"label":"Submersa","value":"submersible"}]},{"key":"foundationType","label":"Fundação","type":"select","options":[{"label":"Sólida / rígida","value":"solid"},{"label":"Flexível","value":"flexible"}]},{"key":"couplingType","label":"Acoplamento","type":"select","options":[{"label":"Flexível","value":"flexible"},{"label":"Rígido","value":"rigid"},{"label":"Direto","value":"direct"}]}]', true),
('fan', 'Ventilador', 'Ventilador, exaustor ou soprador industrial.', 1, '[{"key":"ratedPowerKw","label":"Potência nominal","type":"number","unit":"kW"},{"key":"nominalSpeedRpm","label":"Rotação nominal","type":"number","unit":"rpm"},{"key":"supportType","label":"Suporte","type":"select","required":true,"options":[{"label":"Rígido","value":"rigid"},{"label":"Flexível","value":"flexible"}]},{"key":"fanType","label":"Tipo de ventilador","type":"select","options":[{"label":"Centrífugo","value":"centrifugal"},{"label":"Axial","value":"axial"},{"label":"Soprador","value":"blower"}]}]', true),
('compressor', 'Compressor', 'Compressor industrial rotativo ou alternativo.', 1, '[{"key":"ratedPowerKw","label":"Potência nominal","type":"number","unit":"kW"},{"key":"nominalSpeedRpm","label":"Rotação nominal","type":"number","unit":"rpm"},{"key":"compressorType","label":"Tipo de compressor","type":"select","required":true,"options":[{"label":"Rotativo","value":"rotary"},{"label":"Alternativo","value":"reciprocating"},{"label":"Parafuso","value":"screw"}]},{"key":"couplingType","label":"Acoplamento","type":"select","options":[{"label":"Flexível","value":"flexible"},{"label":"Rígido","value":"rigid"},{"label":"Direto","value":"direct"}]}]', true),
('gearbox', 'Redutor', 'Redutor ou caixa de engrenagens monitorada.', 1, '[{"key":"ratedPowerKw","label":"Potência nominal","type":"number","unit":"kW"},{"key":"inputSpeedRpm","label":"Rotação de entrada","type":"number","unit":"rpm"},{"key":"ratio","label":"Relação de redução","type":"number"},{"key":"gearType","label":"Tipo de engrenagem","type":"select","options":[{"label":"Helicoidal","value":"helical"},{"label":"Cônica","value":"bevel"},{"label":"Sem-fim","value":"worm"},{"label":"Planetária","value":"planetary"}]}]', true);--> statement-breakpoint
INSERT INTO `standards` (`code`, `name`, `family`, `status`, `scope`, `version`, `metadata`) VALUES
('ISO-20816-3:2022', 'ISO 20816-3:2022', 'vibration', 'current', 'Medição e avaliação de vibração em máquinas industriais acima de 15 kW e entre 120 rpm e 30000 rpm.', 1, '{"appliesToEquipmentTypes":["electric_motor","fan","compressor","gearbox"],"legacyCodes":["ISO-10816-3:2009"]}'),
('ISO-10816-3:2009', 'ISO 10816-3:2009', 'vibration', 'legacy', 'Referência legada retirada pela ISO e revisada pela ISO 20816-3:2022.', 1, '{"appliesToEquipmentTypes":["electric_motor","fan","compressor","gearbox"]}');
