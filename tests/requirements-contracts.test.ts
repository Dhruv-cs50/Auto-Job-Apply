import assert from "node:assert/strict";
import test from "node:test";
import {
  jobRequirementExtractionSchema,
  toScorableJobRequirements,
} from "../lib/requirements/contracts.ts";

const text = "Senior Data Scientist. Requires Python and 3 years experience. Hybrid in San Jose.";
const evidence = (quote: string) => {
  const start = text.indexOf(quote);
  return { sourceId: "description", quote, start, end: start + quote.length };
};

function validExtraction() {
  return {
    version: "evidence-v1" as const,
    sources: [{
      id: "description",
      kind: "job_description" as const,
      locator: "https://jobs.example.test/123",
      text,
    }],
    title: { value: "Senior Data Scientist", evidence: [evidence("Senior Data Scientist")] },
    requiredSkills: [{ value: "Python", evidence: [evidence("Python")] }],
    preferredSkills: [],
    minimumYearsExperience: { value: 3, evidence: [evidence("3 years")] },
    degreeKeywords: [],
    location: { value: "San Jose", evidence: [evidence("San Jose")] },
    workplaceType: { value: "hybrid" as const, evidence: [evidence("Hybrid")] },
    requiresExistingAuthorization: null,
    sponsorshipAvailable: null,
  };
}

test("requirement claims retain exact source provenance", () => {
  const parsed = jobRequirementExtractionSchema.parse(validExtraction());
  assert.equal(parsed.requiredSkills[0].evidence[0].quote, "Python");
  assert.equal(parsed.sources[0].locator, "https://jobs.example.test/123");
});

test("unsupported or mismatched evidence is rejected", () => {
  const mismatched = validExtraction();
  mismatched.requiredSkills[0].evidence[0].quote = "SQL";
  assert.equal(jobRequirementExtractionSchema.safeParse(mismatched).success, false);

  const unknownSource = validExtraction();
  unknownSource.title!.evidence[0].sourceId = "missing";
  assert.equal(jobRequirementExtractionSchema.safeParse(unknownSource).success, false);
});

test("unknown requirements remain unknown instead of becoming candidate facts", () => {
  const requirements = toScorableJobRequirements(jobRequirementExtractionSchema.parse(validExtraction()));
  assert.equal(requirements.requiresExistingAuthorization, null);
  assert.equal(requirements.sponsorshipAvailable, null);
  assert.deepEqual(requirements.requiredSkills, ["Python"]);
});
