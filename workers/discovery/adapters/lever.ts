import { z } from "zod";
import { canonicalizeJobUrl, plainText } from "../normalization.ts";
import type { AdapterResult, RawJobEnvelope } from "../types.ts";

const leverPayloadSchema = z.array(z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  hostedUrl: z.string().url(),
  applyUrl: z.string().url().optional(),
  descriptionPlain: z.string().optional(),
  description: z.string().optional(),
  categories: z.object({ location: z.string().optional() }).optional(),
  workplaceType: z.string().optional(),
}));

export function ingestLeverPayload(input: {
  siteToken: string;
  company: string;
  sourceConfigId: string;
  observedAt: string;
  payload: unknown;
}): AdapterResult {
  const payload = leverPayloadSchema.parse(input.payload);
  const records: RawJobEnvelope[] = payload.map((job) => ({
    sourceKind: "lever",
    sourceConfigId: input.sourceConfigId,
    externalJobId: `${input.siteToken}:${job.id}`,
    observedAt: input.observedAt,
    sourceUrl: canonicalizeJobUrl(job.hostedUrl),
    applyUrl: canonicalizeJobUrl(job.applyUrl ?? job.hostedUrl),
    company: input.company,
    title: job.text.trim(),
    location: job.categories?.location?.trim() ?? "",
    description: plainText(job.descriptionPlain ?? job.description),
    postedAt: { value: null, precision: "unknown", confidence: "none", evidence: null },
    rawPayload: job,
    metadata: { siteToken: input.siteToken, workplaceType: job.workplaceType ?? null },
  }));

  return {
    records,
    completeSnapshot: true,
    warnings: records.map((record) => ({
      code: "MISSING_POSTED_AT" as const,
      message: "Lever did not provide a trustworthy publication timestamp.",
      externalJobId: record.externalJobId,
    })),
  };
}
