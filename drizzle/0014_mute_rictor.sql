CREATE TABLE `key_levels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticker` text NOT NULL,
	`price` real NOT NULL,
	`label` text NOT NULL,
	`note` text,
	`updated_at` integer NOT NULL
);
