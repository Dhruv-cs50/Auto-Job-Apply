import { z } from "zod";

const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const requirementSourceSchema = z.object({
  id: boundedText(200),
  kind: z.enum(["job_description", "job_listing_field", "authorized_export", "user_provided"]),
  locator: boundedText(2_000).optional(),
  capturedAt: z.string().datetime({ offset: true }).optional(),
  text: z.string().max(200_000),
}).strict();

export const requirementEvidenceSchema = z.object({
  sourceId: boundedText(200),
  quote: boundedText(4_000),
  start: z.number().int().min(0),
  end: z.number().int().positive(),
}).strict().refine((span) => span.end > span.start, {
  message: "Evidence end must be greater than start",
  path: ["end"],
});

export const evidenceBackedStringSchema = z.object({
  value: boundedText(500),
  evidence: z.array(requirementEvidenceSchema).min(1).max(20),
}).strict();

const evidenceBackedNumberSchema = z.object({
  value: z.number().finite().min(0).max(100),
  evidence: z.array(requirementEvidenceSchema).min(1).max(20),
}).strict();

const evidenceBackedBooleanSchema = z.object({
  value: z.boolean(),
  evidence: z.array(requirementEvidenceSchema).min(1).max(20),
}).strict();

const evidenceBackedWorkplaceSchema = z.object({
  value: z.enum(["remote", "hybrid", "onsite"]),
  evidence: z.array(requirementEvidenceSchema).min(1).max(20),
}).strict();

export const jobRequirementExtractionSchema = z.object({
  version: z.literal("evidence-v1"),
  sources: z.array(requirementSourceSchema).min(1).max(20),
  title: evidenceBackedStringSchema.nullable(),
  requiredSkills: z.array(evidenceBackedStringSchema).max(100),
  preferredSkills: z.array(evidenceBackedStringSchema).max(100),
  minimumYearsExperience: evidenceBackedNumberSchema.nullable(),
  degreeKeywords: z.array(evidenceBackedStringSchema).max(30),
  location: evidenceBackedStringSchema.nullable(),
  workplaceType: evidenceBackedWorkplaceSchema.nullable(),
  requiresExistingAuthorization: evidenceBackedBooleanSchema.nullable(),
  sponsorshipAvailable: evidenceBackedBooleanSchema.nullable(),
}).strict().superRefine((extraction, context) => {
  const sources = new Map(extraction.sources.map((source) => [source.id, source]));
  const evidenceGroups = [
    extraction.title?.evidence,
    ...extraction.requiredSkills.map((item) => item.evidence),
    ...extraction.preferredSkills.map((item) => item.evidence),
    extraction.minimumYearsExperience?.evidence,
    ...extraction.degreeKeywords.map((item) => item.evidence),
    extraction.location?.evidence,
    extraction.workplaceType?.evidence,
    extraction.requiresExistingAuthorization?.evidence,
    extraction.sponsorshipAvailable?.evidence,
  ].filter((group): group is Array<z.infer<typeof requirementEvidenceSchema>> => group !== undefined);

  for (const evidence of evidenceGroups.flat()) {
    const source = sources.get(evidence.sourceId);
    if (!source) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Evidence references unknown source: ${evidence.sourceId}`,
      });
      continue;
    }
    if (source.text.slice(evidence.start, evidence.end) !== evidence.quote) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Evidence quote does not match source ${evidence.sourceId} at the supplied offsets`,
      });
    }
  }
});

export type RequirementSource = z.infer<typeof requirementSourceSchema>;
export type RequirementEvidence = z.infer<typeof requirementEvidenceSchema>;
export type EvidenceBackedString = z.infer<typeof evidenceBackedStringSchema>;
export type JobRequirementExtraction = z.infer<typeof jobRequirementExtractionSchema>;

export type ScorableJobRequirements = {
  title: string;
  requiredSkills: string[];
  preferredSkills: string[];
  minimumYearsExperience: number | null;
  degreeKeywords: string[];
  location: string;
  workplaceType: "remote" | "hybrid" | "onsite" | "unknown";
  requiresExistingAuthorization: boolean | null;
  sponsorshipAvailable: boolean | null;
};

export function parseJobRequirementExtraction(input: unknown): JobRequirementExtraction {
  return jobRequirementExtractionSchema.parse(input);
}

export function toScorableJobRequirements(input: JobRequirementExtraction): ScorableJobRequirements {
  const extraction = jobRequirementExtractionSchema.parse(input);
  return {
    title: extraction.title?.value ?? "",
    requiredSkills: extraction.requiredSkills.map(({ value }) => value),
    preferredSkills: extraction.preferredSkills.map(({ value }) => value),
    minimumYearsExperience: extraction.minimumYearsExperience?.value ?? null,
    degreeKeywords: extraction.degreeKeywords.map(({ value }) => value),
    location: extraction.location?.value ?? "",
    workplaceType: extraction.workplaceType?.value ?? "unknown",
    requiresExistingAuthorization: extraction.requiresExistingAuthorization?.value ?? null,
    sponsorshipAvailable: extraction.sponsorshipAvailable?.value ?? null,
  };
}
