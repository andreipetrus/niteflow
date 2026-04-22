ALTER TABLE `pihole_queries` ADD `pihole_id` integer NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `pihole_queries_pihole_id_unique` ON `pihole_queries` (`pihole_id`);