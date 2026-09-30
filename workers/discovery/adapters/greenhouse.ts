import { z } from "zod";
import { canonicalizeJobUrl, plainText } from "../normalization.ts";
import type { AdapterResult, RawJobEnvelope } from "../types.ts";

const greenhousePayloadSchema = z.object({
  jobs: z.array(z.object({
    id: z.union([z.string(), z.number()]),
    absolute_url: z.string().url(),
    title: z.string().min(1),
    location: z.object({ name: z.string().default("") }).optional(),
    content: z.string().optional(),
    updated_at: z.string().optional(),
    company_name: z.string().optional(),
  })),
});

export function ingestGreenhousePayload(input: {
  boardToken: string;
  company: string;
  sourceConfigId: string;
  observedAt: string;
  payload: unknown;
}): AdapterResult {
  const payload = greenhousePayloadSchema.parse(input.payload);
  const records: RawJobEnvelope[] = payload.jobs.map((job) => ({
    sourceKind: "greenhouse",
    sourceConfigId: input.sourceConfigId,
    externalJobId: `${input.boardToken}:${job.id}`,
    observedAt: input.observedAt,
    sourceUrl: canonicalizeJobUrl(job.absolute_url),
    applyUrl: canonicalizeJobUrl(job.absolute_url),
    company: job.company_name ?? input.company,
    title: job.title.trim(),
    location: job.location?.name.trim() ?? "",
    description: plainText(job.content),
    postedAt: {
      value: null,
      precision: "unknown",
      confidence: "none",
      evidence: job.updated_at ? "Greenhouse updated_at is not treated as publication time." : null,
    },
    rawPayload: job,
    metadata: { boardToken: input.boardToken, sourceUpdatedAt: job.updated_at ?? null },
  }));

  return {
    records,
    completeSnapshot: true,
    warnings: records.map((record) => ({
      code: "MISSING_POSTED_AT" as const,
      message: "Greenhouse did not provide a trustworthy publication timestamp.",
      externalJobId: record.externalJobId,
    })),
  };
}
