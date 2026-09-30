import assert from "node:assert/strict";
import test from "node:test";
import { candidateProfileInputSchema, normalizeResumeText, splitCandidateProfile } from "../lib/candidate-profile.ts";

test("resume text is normalized without deriving verified facts", () => {
  const parsed = candidateProfileInputSchema.parse({
    displayName: "Dhruv Shah",
    resumeText: "Python developer  \r\n\r\n\r\nForecasting",
  });
  assert.equal(parsed.resumeText, "Python developer\n\nForecasting");
  assert.deepEqual(parsed.verifiedSkills, []);
  assert.deepEqual(splitCandidateProfile(parsed).verifiedFacts.verifiedSkills, []);
});

test("candidate lists are trimmed and deduplicated case-insensitively", () => {
  const parsed = candidateProfileInputSchema.parse({
    displayName: "Dhruv Shah",
    verifiedSkills: [" Python ", "python", "SQL"],
  });
  assert.deepEqual(parsed.verifiedSkills, ["python", "SQL"]);
});

test("oversized resume text is rejected", () => {
  assert.equal(candidateProfileInputSchema.safeParse({ displayName: "Dhruv", resumeText: "x".repeat(100_001) }).success, false);
  assert.equal(normalizeResumeText(" A\r\nB "), "A\nB");
});
