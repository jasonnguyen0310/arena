PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_withdrawals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`day_pnl` real NOT NULL,
	`withdraw_amount` real NOT NULL,
	`kept_amount` real NOT NULL,
	`acknowledged_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_withdrawals`("date", "day_pnl", "withdraw_amount", "kept_amount", "acknowledged_at") SELECT "date", "day_pnl", "withdraw_amount", "kept_amount", "acknowledged_at" FROM `withdrawals`;--> statement-breakpoint
DROP TABLE `withdrawals`;--> statement-breakpoint
ALTER TABLE `__new_withdrawals` RENAME TO `withdrawals`;--> statement-breakpoint
PRAGMA foreign_keys=ON;