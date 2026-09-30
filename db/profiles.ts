import { env } from "cloudflare:workers";
import {
  candidateProfileInputSchema,
  splitCandidateProfile,
  type CandidateProfileInput,
  type CandidatePreferences,
  type VerifiedCandidateFacts,
} from "@/lib/candidate-profile";

export type StoredCandidateProfile = {
  id: string;
  ownerId: string;
  displayName: string;
  headline: string;
  resumeText: string;
  preferences: CandidatePreferences;
  verifiedFacts: VerifiedCandidateFacts;
  createdAt: string;
  updatedAt: string;
};

type ProfileRow = {
  id: string;
  owner_id: string;
  display_name: string;
  headline: string;
  resume_text: string;
  preferences_json: string;
  verified_facts_json: string;
  created_at: string;
  updated_at: string;
};

function database(): D1Database {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

function mapProfile(row: ProfileRow): StoredCandidateProfile | null {
  const parsed = candidateProfileInputSchema.safeParse({
    displayName: row.display_name,
    headline: row.headline,
    resumeText: row.resume_text,
    ...JSON.parse(row.preferences_json),
    ...JSON.parse(row.verified_facts_json),
  });
  if (!parsed.success) return null;
  const { preferences, verifiedFacts } = splitCandidateProfile(parsed.data);
  return {
    id: row.id,
    ownerId: row.owner_id,
    displayName: parsed.data.displayName,
    headline: parsed.data.headline,
    resumeText: parsed.data.resumeText,
    preferences,
    verifiedFacts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getProfileByOwner(ownerId: string): Promise<StoredCandidateProfile | null> {
  const row = await database().prepare(`
    SELECT id, owner_id, display_name, headline, resume_text, preferences_json,
           verified_facts_json, created_at, updated_at
    FROM candidate_profiles
    WHERE owner_id = ?
    LIMIT 1
  `).bind(ownerId).first<ProfileRow>();
  return row ? mapProfile(row) : null;
}

export async function upsertProfile(
  ownerId: string,
  input: CandidateProfileInput,
): Promise<StoredCandidateProfile> {
  const parsed = candidateProfileInputSchema.parse(input);
  const { preferences, verifiedFacts } = splitCandidateProfile(parsed);
  const id = crypto.randomUUID();
  await database().prepare(`
    INSERT INTO candidate_profiles (
      id, owner_id, display_name, headline, preferences_json,
      verified_facts_json, resume_text, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(owner_id) DO UPDATE SET
      display_name = excluded.display_name,
      headline = excluded.headline,
      preferences_json = excluded.preferences_json,
      verified_facts_json = excluded.verified_facts_json,
      resume_text = excluded.resume_text,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    id,
    ownerId,
    parsed.displayName,
    parsed.headline,
    JSON.stringify(preferences),
    JSON.stringify(verifiedFacts),
    parsed.resumeText,
  ).run();

  const saved = await getProfileByOwner(ownerId);
  if (!saved) throw new Error("Profile save did not return a stored profile");
  return saved;
}
