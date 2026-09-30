import { z } from "zod";
import { canonicalizeJobUrl, parseRelativePostedAt, plainText, stableCompositeKey } from "../normalization.ts";
import { DiscoveryPolicyError, type AdapterResult, type RawJobEnvelope } from "../types.ts";

const alertSchema = z.object({
  messageId: z.string().min(1),
  sentAt: z.string().datetime(),
  jobs: z.array(z.object({
    url: z.string().url(),
    title: z.string().min(1),
    company: z.string().min(1),
    location: z.string().default(""),
    snippet: z.string().default(""),
    postedLabel: z.string().nullable().optional(),
  })).max(200),
});

export function ingestLinkedInAlert(input: {
  mode: "alert_email" | "user_link" | "authenticated_browser";
  sourceConfigId: string;
  observedAt: string;
  payload: unknown;
}): AdapterResult {
  if (input.mode === "authenticated_browser") {
    throw new DiscoveryPolicyError("Authenticated LinkedIn browsing and automation are not allowed.");
  }
  const payload = alertSchema.parse(input.payload);
  const records: RawJobEnvelope[] = payload.jobs.map((job) => {
    const postedAt = parseRelativePostedAt(job.postedLabel, payload.sentAt);
    const sourceUrl = canonicalizeJobUrl(job.url);
    return {
      sourceKind: "linkedin_alert",
      sourceConfigId: input.sourceConfigId,
      externalJobId: stableCompositeKey([payload.messageId, sourceUrl]),
      observedAt: input.observedAt,
      sourceUrl,
      applyUrl: null,
      company: job.company.trim(),
      title: job.title.trim(),
      location: job.location.trim(),
      description: plainText(job.snippet),
      postedAt: postedAt
        ? { value: postedAt, precision: "relative", confidence: "medium", evidence: `${job.postedLabel} relative to alert Date header` }
        : { value: null, precision: "unknown", confidence: "none", evidence: job.postedLabel ?? null },
      rawPayload: { ...job, messageId: payload.messageId },
      metadata: { messageId: payload.messageId, ingestionMode: input.mode },
    };
  });
  return {
    records,
    completeSnapshot: false,
    warnings: records.filter((record) => !record.description).map((record) => ({
      code: "INCOMPLETE_DESCRIPTION" as const,
      message: "The alert did not include a complete job description.",
      externalJobId: record.externalJobId,
    })),
  };
}
