DROP INDEX `idx_applications_job_id`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_applications_owner_job_id` ON `applications` (`owner_id`,`job_id`);