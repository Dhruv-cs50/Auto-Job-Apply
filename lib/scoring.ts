import type {
  CandidatePreferences,
  VerifiedCandidateFacts,
} from "./candidate-profile.ts";

export const SCORER_VERSION = "deterministic-v1";

export type JobRequirements = {
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

export type FitAssessment = {
  eligible: boolean;
  score: number;
  matched: string[];
  gaps: string[];
  breakdown: Record<string, { earned: number; possible: number }>;
  scorerVersion: string;
};

const normalize = (value: string) => value.trim().toLocaleLowerCase();

function includesPhrase(values: string[], target: string): boolean {
  const normalizedTarget = normalize(target);
  return values.some((value) => {
    const normalizedValue = normalize(value);
    return normalizedValue === normalizedTarget || normalizedValue.includes(normalizedTarget) || normalizedTarget.includes(normalizedValue);
  });
}

function ratio(earned: number, possible: number): number {
  return possible === 0 ? 0 : earned / possible;
}

export function assessCandidateFit(
  preferences: CandidatePreferences,
  facts: VerifiedCandidateFacts,
  job: JobRequirements,
): FitAssessment {
  const matched: string[] = [];
  const gaps: string[] = [];

  if (job.requiresExistingAuthorization === true && facts.workAuthorization === "not_authorized") {
    gaps.push("The role requires existing work authorization.");
  }
  if (facts.requiresSponsorship === true && job.sponsorshipAvailable === false) {
    gaps.push("The candidate requires sponsorship, but this role does not offer it.");
  }
  const eligible = gaps.length === 0;

  const requiredMatches = job.requiredSkills.filter((skill) => includesPhrase(facts.verifiedSkills, skill));
  const preferredMatches = job.preferredSkills.filter((skill) => includesPhrase(facts.verifiedSkills, skill));
  const skillPossible = job.requiredSkills.length * 2 + job.preferredSkills.length;
  const skillEarned = requiredMatches.length * 2 + preferredMatches.length;
  requiredMatches.forEach((skill) => matched.push(`Required skill: ${skill}`));
  preferredMatches.forEach((skill) => matched.push(`Preferred skill: ${skill}`));
  job.requiredSkills
    .filter((skill) => !requiredMatches.includes(skill))
    .forEach((skill) => gaps.push(`Missing verified required skill: ${skill}`));

  const titleEarned = includesPhrase(preferences.targetTitles, job.title) ? 1 : 0;
  if (titleEarned) matched.push(`Target title alignment: ${job.title}`);

  let experienceEarned = 0;
  let experiencePossible = 0;
  if (job.minimumYearsExperience !== null) {
    experiencePossible = 1;
    if (
      facts.verifiedYearsExperience !== null &&
      facts.verifiedYearsExperience >= job.minimumYearsExperience
    ) {
      experienceEarned = 1;
      matched.push(`Verified experience meets ${job.minimumYearsExperience}+ years.`);
    } else {
      gaps.push(`No verified evidence of ${job.minimumYearsExperience}+ years of experience.`);
    }
  }

  let degreeEarned = 0;
  const degreePossible = job.degreeKeywords.length ? 1 : 0;
  if (degreePossible) {
    degreeEarned = job.degreeKeywords.some((degree) => includesPhrase(facts.verifiedDegrees, degree)) ? 1 : 0;
    if (degreeEarned) matched.push("Verified education aligns with the role.");
    else gaps.push("No verified matching degree was provided.");
  }

  let locationEarned = 0;
  const locationPossible = job.location || job.workplaceType !== "unknown" ? 1 : 0;
  if (locationPossible) {
    const remoteMatch = job.workplaceType === "remote" && ["remote", "flexible"].includes(preferences.remotePreference);
    const onsiteMatch = job.workplaceType === "onsite" && ["onsite", "flexible"].includes(preferences.remotePreference);
    const hybridMatch = job.workplaceType === "hybrid" && ["hybrid", "flexible"].includes(preferences.remotePreference);
    const locationMatch = Boolean(job.location) && includesPhrase(preferences.preferredLocations, job.location);
    locationEarned = remoteMatch || onsiteMatch || hybridMatch || locationMatch ? 1 : 0;
    if (locationEarned) matched.push("Location or workplace preference aligns.");
  }

  const breakdown = {
    skills: { earned: skillEarned, possible: skillPossible },
    title: { earned: titleEarned, possible: 1 },
    experience: { earned: experienceEarned, possible: experiencePossible },
    education: { earned: degreeEarned, possible: degreePossible },
    location: { earned: locationEarned, possible: locationPossible },
  };

  const dimensions = [
    { weight: 50, ...breakdown.skills },
    { weight: 20, ...breakdown.title },
    { weight: 15, ...breakdown.experience },
    { weight: 10, ...breakdown.education },
    { weight: 5, ...breakdown.location },
  ].filter((dimension) => dimension.possible > 0);
  const activeWeight = dimensions.reduce((total, dimension) => total + dimension.weight, 0);
  const rawScore = activeWeight
    ? dimensions.reduce((total, dimension) => total + ratio(dimension.earned, dimension.possible) * dimension.weight, 0) / activeWeight
    : 0;

  return {
    eligible,
    score: eligible ? Math.round(rawScore * 100) : 0,
    matched,
    gaps,
    breakdown,
    scorerVersion: SCORER_VERSION,
  };
}
