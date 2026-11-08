CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`player` text NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`answers` text DEFAULT '[]' NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `runs_day_completed` ON `runs` (`day`,`completed`);