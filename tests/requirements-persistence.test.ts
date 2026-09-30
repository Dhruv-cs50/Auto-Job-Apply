import assert from "node:assert/strict";
import test from "node:test";
import {
  getFitAssessment,
  upsertFitAssessment,
  type AssessmentDatabase,
} from "../db/assessments.ts";

const sourceText = "Requires Python.";
const extraction = {
  version: "evidence-v1" as const,
  sources: [{ id: "description", kind: "job_description" as const, text: sourceText }],
  title: null,
  requiredSkills: [{
    value: "Python",
    evidence: [{ sourceId: "description", quote: "Python", start: 9, end: 15 }],
  }],
  preferredSkills: [],
  minimumYearsExperience: null,
  degreeKeywords: [],
  location: null,
  workplaceType: null,
  requiresExistingAuthorization: null,
  sponsorshipAvailable: null,
};

test("fit assessment upsert is owner-scoped and retains requirement provenance", async () => {
  const calls: Array<{ query: string; values: unknown[] }> = [];
  let storedEnvelope = "";
  const row = {
    id: "assessment-1", owner_id: "owner-1", profile_id: "profile-1", job_id: "job-1",
    eligible: 1, score: 80, breakdown_json: "", matched_json: JSON.stringify(["Required skill: Python"]),
    gaps_json: "[]", scorer_version: "deterministic-v1",
    created_at: "2026-09-29T12:00:00Z", updated_at: "2026-09-29T12:00:00Z",
  };
  const database: AssessmentDatabase = {
    prepare(query) {
      const call = { query, values: [] as unknown[] };
      calls.push(call);
      return {
        bind(...values: unknown[]) {
          call.values = values;
          if (query.includes("INSERT INTO")) storedEnvelope = String(values[6]);
          return this;
        },
        async run() { return {}; },
        async first<T>() {
          return query.includes("SELECT")
            ? ({ ...row, breakdown_json: storedEnvelope } as T)
            : null;
        },
      };
    },
  };

  const saved = await upsertFitAssessment(database, {
    id: "assessment-1", ownerId: "owner-1", profileId: "profile-1", jobId: "job-1",
    eligible: true, score: 80,
    breakdown: { skills: { earned: 2, possible: 2 } },
    matched: ["Required skill: Python"], gaps: [], scorerVersion: "deterministic-v1",
    requirementExtraction: extraction,
  });

  assert.equal(saved.requirementExtraction?.requiredSkills[0].evidence[0].quote, "Python");
  assert.match(calls[0].query, /ON CONFLICT\(owner_id, job_id\)/);
  assert.deepEqual(calls[1].values, ["owner-1", "job-1"]);
});

test("invalid assessment values are rejected before a database write", async () => {
  let prepared = false;
  const database: AssessmentDatabase = {
    prepare() {
      prepared = true;
      throw new Error("must not prepare");
    },
  };
  await assert.rejects(() => upsertFitAssessment(database, {
    ownerId: "owner-1", profileId: "profile-1", jobId: "job-1",
    eligible: false, score: 50, breakdown: {}, matched: [], gaps: [], scorerVersion: "v1",
  }), /ineligible assessment must have a zero score/);
  assert.equal(prepared, false);
});

test("fit assessment reads require both owner and job identity", async () => {
  const seen: unknown[][] = [];
  const database: AssessmentDatabase = {
    prepare() {
      return {
        bind(...values: unknown[]) { seen.push(values); return this; },
        async run() { return {}; },
        async first<T>() { return null as T | null; },
      };
    },
  };
  assert.equal(await getFitAssessment(database, "owner-2", "job-2"), null);
  assert.deepEqual(seen, [["owner-2", "job-2"]]);
});
