import assert from "node:assert/strict";
import test from "node:test";
import type { CandidatePreferences, VerifiedCandidateFacts } from "../lib/candidate-profile.ts";
import { assessCandidateFit, type JobRequirements } from "../lib/scoring.ts";

const preferences: CandidatePreferences = {
  targetTitles: ["Data Scientist"],
  preferredLocations: ["San Jose", "Remote US"],
  remotePreference: "flexible",
  minimumSalary: 120_000,
};
const facts: VerifiedCandidateFacts = {
  verifiedSkills: ["Python", "SQL", "time-series forecasting"],
  verifiedYearsExperience: 4,
  verifiedDegrees: ["MS Data Analytics"],
  workAuthorization: "authorized",
  requiresSponsorship: false,
};
const job: JobRequirements = {
  title: "Senior Data Scientist",
  requiredSkills: ["Python", "SQL"],
  preferredSkills: ["forecasting", "PyTorch"],
  minimumYearsExperience: 3,
  degreeKeywords: ["Data Analytics"],
  location: "San Jose",
  workplaceType: "hybrid",
  requiresExistingAuthorization: true,
  sponsorshipAvailable: false,
};

test("fit scoring is deterministic, bounded, and explainable", () => {
  const first = assessCandidateFit(preferences, facts, job);
  const second = assessCandidateFit(preferences, facts, job);
  assert.deepEqual(first, second);
  assert.equal(first.eligible, true);
  assert.equal(first.score >= 0 && first.score <= 100, true);
  assert.equal(first.matched.some((item) => item.includes("Python")), true);
  assert.equal(first.gaps.some((item) => item.includes("PyTorch")), false);
});

test("a hard eligibility conflict forces score to zero", () => {
  const assessment = assessCandidateFit(
    preferences,
    { ...facts, workAuthorization: "not_authorized", requiresSponsorship: true },
    job,
  );
  assert.equal(assessment.eligible, false);
  assert.equal(assessment.score, 0);
  assert.equal(assessment.gaps.length >= 2, true);
});

test("unverified resume claims cannot contribute to score", () => {
  const assessment = assessCandidateFit(preferences, { ...facts, verifiedSkills: [] }, job);
  assert.equal(assessment.breakdown.skills.earned, 0);
  assert.equal(assessment.gaps.some((item) => item.includes("Python")), true);
});
