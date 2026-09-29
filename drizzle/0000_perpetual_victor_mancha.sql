CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`approved_at` text,
	`submitted_at` text,
	`confirmation_reference` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `job_listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_applications_job_id` ON `applications` (`job_id`);--> statement-breakpoint
CREATE INDEX `idx_applications_status` ON `applications` (`status`);--> statement-breakpoint
CREATE TABLE `candidate_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`display_name` text NOT NULL,
	`headline` text DEFAULT '' NOT NULL,
	`preferences_json` text DEFAULT '{}' NOT NULL,
	`verified_facts_json` text DEFAULT '{}' NOT NULL,
	`resume_object_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_candidate_profiles_owner_id` ON `candidate_profiles` (`owner_id`);--> statement-breakpoint
CREATE TABLE `discovery_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`status` text DEFAULT 'running' NOT NULL,
	`source_counts_json` text DEFAULT '{}' NOT NULL,
	`error_summary` text
);
--> statement-breakpoint
CREATE TABLE `job_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_job_id` text NOT NULL,
	`url` text NOT NULL,
	`company` text NOT NULL,
	`title` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`posted_at` text,
	`discovered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`fit_score` integer DEFAULT 0 NOT NULL,
	`fit_explanation` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'discovered' NOT NULL,
	`next_action` text DEFAULT 'Review fit summary' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_job_listings_source_job_id` ON `job_listings` (`source`,`source_job_id`);--> statement-breakpoint
CREATE INDEX `idx_job_listings_status_fit` ON `job_listings` (`status`,`fit_score`);--> statement-breakpoint
CREATE INDEX `idx_job_listings_posted_at` ON `job_listings` (`posted_at`);