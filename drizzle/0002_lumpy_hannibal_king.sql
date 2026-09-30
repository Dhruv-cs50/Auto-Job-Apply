CREATE TABLE `application_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`application_id` text NOT NULL,
	`event_type` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_application_events_application_created` ON `application_events` (`application_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_application_events_owner_created` ON `application_events` (`owner_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `applications` ADD `owner_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `applications` ADD `answer_set_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `applications` ADD `answer_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `applications` ADD `approved_answer_revision` integer;--> statement-breakpoint
ALTER TABLE `applications` ADD `approval_id` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `idempotency_key` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `blocked_reason` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `last_error_summary` text;--> statement-breakpoint
CREATE INDEX `idx_applications_owner_status` ON `applications` (`owner_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_applications_idempotency_key` ON `applications` (`idempotency_key`);