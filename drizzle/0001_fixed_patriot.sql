CREATE TABLE `fit_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`job_id` text NOT NULL,
	`eligible` integer DEFAULT true NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`breakdown_json` text DEFAULT '{}' NOT NULL,
	`matched_json` text DEFAULT '[]' NOT NULL,
	`gaps_json` text DEFAULT '[]' NOT NULL,
	`scorer_version` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `candidate_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `job_listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_fit_assessments_owner_job` ON `fit_assessments` (`owner_id`,`job_id`);--> statement-breakpoint
CREATE INDEX `idx_fit_assessments_owner_score` ON `fit_assessments` (`owner_id`,`eligible`,`score`);--> statement-breakpoint
ALTER TABLE `candidate_profiles` ADD `resume_text` text DEFAULT '' NOT NULL;