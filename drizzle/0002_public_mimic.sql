CREATE TABLE `daily_states` (
	`date` text PRIMARY KEY NOT NULL,
	`gauge` integer NOT NULL,
	`note` text,
	`updated_at` integer NOT NULL
);
