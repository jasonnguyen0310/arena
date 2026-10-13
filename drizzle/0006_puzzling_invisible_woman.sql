CREATE TABLE `trade_trims` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trade_id` integer NOT NULL,
	`ordinal` integer NOT NULL,
	`contracts` real NOT NULL,
	`price` real NOT NULL,
	`at` integer NOT NULL,
	FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE cascade
);
