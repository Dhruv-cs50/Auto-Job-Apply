import {
  jobRequirementExtractionSchema,
  type JobRequirementExtraction,
} from "../lib/requirements/contracts.ts";

export type FitBreakdown = Record<string, { earned: number; possible: number }>;

export type FitAssessmentWrite = {
  id?: string;
  ownerId: string;
  profileId: string;
  jobId: string;
  eligible: boolean;
  score: number;
  breakdown: FitBreakdown;
  matched: string[];
  gaps: string[];
  scorerVersion: string;
  requirementExtraction?: JobRequirementExtraction | null;
};

export type StoredFitAssessment = Required<Omit<FitAssessmentWrite, "requirementExtraction">> & {
  requirementExtraction: JobRequirementExtraction | null;
  createdAt: string;
  updatedAt: string;
};

type AssessmentRow = {
  id: string;
  owner_id: string;
  profile_id: string;
  job_id: string;
  eligible: number | boolean;
  score: number;
  breakdown_json: string;
  matched_json: string;
  gaps_json: string;
  scorer_version: string;
  created_at: string;
  updated_at: string;
};

type PreparedStatement = {
  bind(...values: unknown[]): PreparedStatement;
  run(): Promise<unknown>;
  first<T>(): Promise<T | null>;
};

export type AssessmentDatabase = {
  prepare(query: string): PreparedStatement;
};

type BreakdownEnvelope = {
  version: "fit-assessment-v1";
  dimensions: FitBreakdown;
  requirementExtraction: JobRequirementExtraction | null;
};

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function validateWrite(input: FitAssessmentWrite): FitAssessmentWrite {
  requiredText(input.ownerId, "ownerId");
  requiredText(input.profileId, "profileId");
  requiredText(input.jobId, "jobId");
  requiredText(input.scorerVersion, "scorerVersion");
  if (!Number.isInteger(input.score) || input.score < 0 || input.score > 100) {
    throw new Error("score must be an integer from 0 through 100");
  }
  if (!input.eligible && input.score !== 0) {
    throw new Error("an ineligible assessment must have a zero score");
  }
  for (const [name, value] of Object.entries(input.breakdown)) {
    if (!name.trim() || !Number.isFinite(value.earned) || !Number.isFinite(value.possible)
      || value.earned < 0 || value.possible < 0 || value.earned > value.possible) {
      throw new Error(`invalid breakdown dimension: ${name}`);
    }
  }
  if (input.requirementExtraction !== undefined && input.requirementExtraction !== null) {
    jobRequirementExtractionSchema.parse(input.requirementExtraction);
  }
  return input;
}

function parseStringArray(serialized: string, field: string): string[] {
  const parsed: unknown = JSON.parse(serialized);
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    throw new Error(`Invalid ${field} stored for fit assessment`);
  }
  return parsed;
}

function parseEnvelope(serialized: string): BreakdownEnvelope {
  const parsed: unknown = JSON.parse(serialized);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Invalid breakdown stored for fit assessment");
  }
  const candidate = parsed as Partial<BreakdownEnvelope>;
  if (candidate.version !== "fit-assessment-v1" || typeof candidate.dimensions !== "object" || candidate.dimensions === null) {
    throw new Error("Unsupported fit assessment breakdown envelope");
  }
  const requirementExtraction = candidate.requirementExtraction === null
    ? null
    : jobRequirementExtractionSchema.parse(candidate.requirementExtraction);
  return {
    version: "fit-assessment-v1",
    dimensions: candidate.dimensions,
    requirementExtraction,
  };
}

function mapAssessment(row: AssessmentRow): StoredFitAssessment {
  const envelope = parseEnvelope(row.breakdown_json);
  return {
    id: row.id,
    ownerId: row.owner_id,
    profileId: row.profile_id,
    jobId: row.job_id,
    eligible: Boolean(row.eligible),
    score: row.score,
    breakdown: envelope.dimensions,
    matched: parseStringArray(row.matched_json, "matched evidence"),
    gaps: parseStringArray(row.gaps_json, "gaps"),
    scorerVersion: row.scorer_version,
    requirementExtraction: envelope.requirementExtraction,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getFitAssessment(
  database: AssessmentDatabase,
  ownerId: string,
  jobId: string,
): Promise<StoredFitAssessment | null> {
  requiredText(ownerId, "ownerId");
  requiredText(jobId, "jobId");
  const row = await database.prepare(`
    SELECT id, owner_id, profile_id, job_id, eligible, score, breakdown_json,
           matched_json, gaps_json, scorer_version, created_at, updated_at
    FROM fit_assessments
    WHERE owner_id = ? AND job_id = ?
    LIMIT 1
  `).bind(ownerId, jobId).first<AssessmentRow>();
  return row ? mapAssessment(row) : null;
}

export async function upsertFitAssessment(
  database: AssessmentDatabase,
  input: FitAssessmentWrite,
): Promise<StoredFitAssessment> {
  validateWrite(input);
  const id = input.id ?? crypto.randomUUID();
  const envelope: BreakdownEnvelope = {
    version: "fit-assessment-v1",
    dimensions: input.breakdown,
    requirementExtraction: input.requirementExtraction ?? null,
  };
  await database.prepare(`
    INSERT INTO fit_assessments (
      id, owner_id, profile_id, job_id, eligible, score, breakdown_json,
      matched_json, gaps_json, scorer_version, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(owner_id, job_id) DO UPDATE SET
      profile_id = excluded.profile_id,
      eligible = excluded.eligible,
      score = excluded.score,
      breakdown_json = excluded.breakdown_json,
      matched_json = excluded.matched_json,
      gaps_json = excluded.gaps_json,
      scorer_version = excluded.scorer_version,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    id,
    input.ownerId,
    input.profileId,
    input.jobId,
    input.eligible ? 1 : 0,
    input.score,
    JSON.stringify(envelope),
    JSON.stringify(input.matched),
    JSON.stringify(input.gaps),
    input.scorerVersion,
  ).run();

  const saved = await getFitAssessment(database, input.ownerId, input.jobId);
  if (!saved) throw new Error("Fit assessment save did not return a stored assessment");
  return saved;
}
