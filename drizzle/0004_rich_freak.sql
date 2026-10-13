CREATE TABLE `withdrawals` (
	`date` text PRIMARY KEY NOT NULL,
	`day_pnl` real NOT NULL,
	`withdraw_amount` real NOT NULL,
	`kept_amount` real NOT NULL,
	`acknowledged_at` integer NOT NULL
);
