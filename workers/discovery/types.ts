export type SourceKind =
  | "greenhouse"
  | "lever"
  | "linkedin_alert"
  | "jobright"
  | "company_site";

export type PostedAtEvidence = {
  value: string | null;
  precision: "instant" | "date" | "relative" | "unknown";
  confidence: "high" | "medium" | "low" | "none";
  evidence: string | null;
};

export type RawJobEnvelope = {
  sourceKind: SourceKind;
  sourceConfigId: string;
  externalJobId: string;
  observedAt: string;
  sourceUrl: string;
  applyUrl: string | null;
  company: string;
  title: string;
  location: string;
  description: string;
  postedAt: PostedAtEvidence;
  rawPayload: unknown;
  metadata: Record<string, unknown>;
};

export type AdapterWarning = {
  code: "MISSING_POSTED_AT" | "INCOMPLETE_DESCRIPTION" | "UNSUPPORTED_RECORD";
  message: string;
  externalJobId?: string;
};

export type AdapterResult = {
  records: RawJobEnvelope[];
  completeSnapshot: boolean;
  warnings: AdapterWarning[];
};

export class DiscoveryPolicyError extends Error {
  readonly code = "POLICY_BLOCKED";

  constructor(message: string) {
    super(message);
    this.name = "DiscoveryPolicyError";
  }
}
