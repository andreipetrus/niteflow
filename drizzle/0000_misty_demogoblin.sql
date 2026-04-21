CREATE TABLE `domain_categories` (
	`domain` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`source` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pihole_queries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer NOT NULL,
	`domain` text NOT NULL,
	`client_ip` text NOT NULL,
	`status` text NOT NULL,
	`category` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sleep_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`start_ts` integer NOT NULL,
	`end_ts` integer NOT NULL,
	`value` real,
	`unit` text,
	`source` text
);
--> statement-breakpoint
CREATE TABLE `sleep_sessions` (
	`date` text PRIMARY KEY NOT NULL,
	`quality_score` real NOT NULL,
	`total_min` real NOT NULL,
	`deep_pct` real NOT NULL,
	`rem_pct` real NOT NULL,
	`hrv_avg` real,
	`efficiency` real NOT NULL
);
