import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const candidateProfiles = sqliteTable("candidate_profiles", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  displayName: text("display_name").notNull(),
  headline: text("headline").notNull().default(""),
  preferencesJson: text("preferences_json").notNull().default("{}"),
  verifiedFactsJson: text("verified_facts_json").notNull().default("{}"),
  resumeText: text("resume_text").notNull().default(""),
  resumeObjectKey: text("resume_object_key"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_candidate_profiles_owner_id").on(table.ownerId)]);

export const jobListings = sqliteTable("job_listings", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  sourceJobId: text("source_job_id").notNull(),
  url: text("url").notNull(),
  company: text("company").notNull(),
  title: text("title").notNull(),
  location: text("location").notNull().default(""),
  description: text("description").notNull().default(""),
  postedAt: text("posted_at"),
  discoveredAt: text("discovered_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  fitScore: integer("fit_score").notNull().default(0),
  fitExplanation: text("fit_explanation").notNull().default(""),
  status: text("status").notNull().default("discovered"),
  nextAction: text("next_action").notNull().default("Review fit summary"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_job_listings_source_job_id").on(table.source, table.sourceJobId),
  index("idx_job_listings_status_fit").on(table.status, table.fitScore),
  index("idx_job_listings_posted_at").on(table.postedAt),
]);

export const applications = sqliteTable("applications", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().default(""),
  jobId: text("job_id").notNull().references(() => jobListings.id),
  status: text("status").notNull().default("draft"),
  answerSetJson: text("answer_set_json").notNull().default("{}"),
  answerRevision: integer("answer_revision").notNull().default(0),
  approvedAnswerRevision: integer("approved_answer_revision"),
  approvalId: text("approval_id"),
  idempotencyKey: text("idempotency_key"),
  blockedReason: text("blocked_reason"),
  lastErrorSummary: text("last_error_summary"),
  approvedAt: text("approved_at"),
  submittedAt: text("submitted_at"),
  confirmationReference: text("confirmation_reference"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_applications_owner_job_id").on(table.ownerId, table.jobId),
  index("idx_applications_status").on(table.status),
  index("idx_applications_owner_status").on(table.ownerId, table.status),
  uniqueIndex("idx_applications_idempotency_key").on(table.idempotencyKey),
]);

export const applicationEvents = sqliteTable("application_events", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  applicationId: text("application_id").notNull().references(() => applications.id),
  eventType: text("event_type").notNull(),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  detailJson: text("detail_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_application_events_application_created").on(table.applicationId, table.createdAt),
  index("idx_application_events_owner_created").on(table.ownerId, table.createdAt),
]);

export const fitAssessments = sqliteTable("fit_assessments", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  profileId: text("profile_id").notNull().references(() => candidateProfiles.id),
  jobId: text("job_id").notNull().references(() => jobListings.id),
  eligible: integer("eligible", { mode: "boolean" }).notNull().default(true),
  score: integer("score").notNull().default(0),
  breakdownJson: text("breakdown_json").notNull().default("{}"),
  matchedJson: text("matched_json").notNull().default("[]"),
  gapsJson: text("gaps_json").notNull().default("[]"),
  scorerVersion: text("scorer_version").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_fit_assessments_owner_job").on(table.ownerId, table.jobId),
  index("idx_fit_assessments_owner_score").on(table.ownerId, table.eligible, table.score),
]);

export const discoveryRuns = sqliteTable("discovery_runs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().default(""),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  status: text("status").notNull().default("running"),
  sourceCountsJson: text("source_counts_json").notNull().default("{}"),
  errorSummary: text("error_summary"),
});
