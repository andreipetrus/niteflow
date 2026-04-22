PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sleep_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`start_ts` integer NOT NULL,
	`end_ts` integer NOT NULL,
	`value` text,
	`unit` text,
	`source` text
);
--> statement-breakpoint
INSERT INTO `__new_sleep_records`("id", "type", "start_ts", "end_ts", "value", "unit", "source") SELECT "id", "type", "start_ts", "end_ts", "value", "unit", "source" FROM `sleep_records`;--> statement-breakpoint
DROP TABLE `sleep_records`;--> statement-breakpoint
ALTER TABLE `__new_sleep_records` RENAME TO `sleep_records`;--> statement-breakpoint
PRAGMA foreign_keys=ON;