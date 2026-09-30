import { z } from "zod";

const trimmedString = (max: number) => z.string().trim().max(max);
const uniqueStringList = (maxItems: number, maxLength: number) =>
  z.array(trimmedString(maxLength).min(1)).max(maxItems).transform((items) => [
    ...new Map(items.map((item) => [item.toLocaleLowerCase(), item])).values(),
  ]);

export const remotePreferenceSchema = z.enum(["remote", "hybrid", "onsite", "flexible"]);
export const workAuthorizationSchema = z.enum([
  "authorized",
  "authorized_with_expiration",
  "not_authorized",
  "prefer_not_to_say",
]);

export const candidateProfileInputSchema = z.object({
  displayName: trimmedString(120).min(1),
  headline: trimmedString(240).default(""),
  resumeText: z.string().max(100_000).transform(normalizeResumeText).default(""),
  targetTitles: uniqueStringList(30, 160).default([]),
  preferredLocations: uniqueStringList(30, 160).default([]),
  remotePreference: remotePreferenceSchema.default("flexible"),
  minimumSalary: z.number().int().min(0).max(10_000_000).nullable().default(null),
  verifiedSkills: uniqueStringList(100, 120).default([]),
  verifiedYearsExperience: z.number().min(0).max(80).nullable().default(null),
  verifiedDegrees: uniqueStringList(20, 240).default([]),
  workAuthorization: workAuthorizationSchema.default("prefer_not_to_say"),
  requiresSponsorship: z.boolean().nullable().default(null),
});

export type CandidateProfileInput = z.infer<typeof candidateProfileInputSchema>;

export type CandidatePreferences = Pick<
  CandidateProfileInput,
  "targetTitles" | "preferredLocations" | "remotePreference" | "minimumSalary"
>;

export type VerifiedCandidateFacts = Pick<
  CandidateProfileInput,
  | "verifiedSkills"
  | "verifiedYearsExperience"
  | "verifiedDegrees"
  | "workAuthorization"
  | "requiresSponsorship"
>;

export function normalizeResumeText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitCandidateProfile(input: CandidateProfileInput): {
  preferences: CandidatePreferences;
  verifiedFacts: VerifiedCandidateFacts;
} {
  return {
    preferences: {
      targetTitles: input.targetTitles,
      preferredLocations: input.preferredLocations,
      remotePreference: input.remotePreference,
      minimumSalary: input.minimumSalary,
    },
    verifiedFacts: {
      verifiedSkills: input.verifiedSkills,
      verifiedYearsExperience: input.verifiedYearsExperience,
      verifiedDegrees: input.verifiedDegrees,
      workAuthorization: input.workAuthorization,
      requiresSponsorship: input.requiresSponsorship,
    },
  };
}
