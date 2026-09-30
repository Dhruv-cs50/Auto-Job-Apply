import { z } from "zod";
import { canonicalizeJobUrl, plainText, stableCompositeKey } from "../normalization.ts";
import { DiscoveryPolicyError, type AdapterResult, type RawJobEnvelope } from "../types.ts";

const jobrightRecordsSchema = z.array(z.object({
  id: z.union([z.string(), z.number()]).optional(),
  url: z.string().url(),
  applyUrl: z.string().url().optional(),
  company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().default(""),
  description: z.string().default(""),
  postedAt: z.string().datetime().nullable().optional(),
})).max(10_000);

export type JobrightAuthorization =
  | "user_export"
  | "notification_email"
  | "documented_api"
  | "user_link"
  | "private_endpoint"
  | "browser_cookie";

export function ingestJobrightRecords(input: {
  authorization: JobrightAuthorization;
  sourceConfigId: string;
  observedAt: string;
  payload: unknown;
}): AdapterResult {
  if (["private_endpoint", "browser_cookie"].includes(input.authorization)) {
    throw new DiscoveryPolicyError("Jobright private endpoints and browser-cookie reuse are not allowed.");
  }
  const payload = jobrightRecordsSchema.parse(input.payload);
  const records: RawJobEnvelope[] = payload.map((job) => {
    const sourceUrl = canonicalizeJobUrl(job.url);
    return {
      sourceKind: "jobright",
      sourceConfigId: input.sourceConfigId,
      externalJobId: String(job.id ?? stableCompositeKey([job.company, job.title, job.location, sourceUrl])),
      observedAt: input.observedAt,
      sourceUrl,
      applyUrl: job.applyUrl ? canonicalizeJobUrl(job.applyUrl) : null,
      company: job.company.trim(),
      title: job.title.trim(),
      location: job.location.trim(),
      description: plainText(job.description),
      postedAt: job.postedAt
        ? { value: job.postedAt, precision: "instant", confidence: "medium", evidence: `Jobright ${input.authorization} field` }
        : { value: null, precision: "unknown", confidence: "none", evidence: null },
      rawPayload: job,
      metadata: { authorization: input.authorization },
    };
  });
  return {
    records,
    completeSnapshot: input.authorization === "documented_api" || input.authorization === "user_export",
    warnings: records.filter((record) => !record.postedAt.value).map((record) => ({
      code: "MISSING_POSTED_AT" as const,
      message: "The authorized Jobright record did not include a publication timestamp.",
      externalJobId: record.externalJobId,
    })),
  };
}
