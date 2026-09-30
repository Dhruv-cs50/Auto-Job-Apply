import type { ApplicationSnapshot, PauseReason } from "../../lib/application/state-machine.ts";

export type ApplicationAnswer = {
  field: string;
  value: string | boolean | number;
  source: "verified_profile" | "user_answer";
};

export type BrowserSubmissionCommand = {
  commandId: string;
  idempotencyKey: string;
  applicationId: string;
  jobId: string;
  applyUrl: string;
  answerRevision: number;
  approvalId: string;
  answers: ApplicationAnswer[];
};

export type BrowserWorkerResult =
  | { status: "submitted"; confirmationReference: string; submittedAt: string }
  | { status: "paused"; reason: PauseReason; field?: string }
  | { status: "failed"; retryable: boolean; errorCode: string; summary: string };

export class SubmissionGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubmissionGuardError";
  }
}

export function createSubmissionCommand(input: {
  application: ApplicationSnapshot;
  applyUrl: string;
  answers: ApplicationAnswer[];
  idempotencyKey: string;
  commandId?: string;
}): BrowserSubmissionCommand {
  const { application } = input;
  if (application.status !== "approved" && application.status !== "queued") {
    throw new SubmissionGuardError("The application must be approved before a browser command is created.");
  }
  if (!application.approvalId || application.approvedAnswerRevision !== application.answerRevision) {
    throw new SubmissionGuardError("Approval does not cover the current answer set.");
  }
  const url = new URL(input.applyUrl);
  if (url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com")) {
    throw new SubmissionGuardError("LinkedIn application automation is not allowed.");
  }
  if (!input.idempotencyKey.trim()) {
    throw new SubmissionGuardError("An idempotency key is required.");
  }
  for (const answer of input.answers) {
    if (!answer.field.trim() || (typeof answer.value === "string" && !answer.value.trim())) {
      throw new SubmissionGuardError("Every application field needs an explicit, sourced answer.");
    }
  }

  return {
    commandId: input.commandId ?? crypto.randomUUID(),
    idempotencyKey: input.idempotencyKey,
    applicationId: application.id,
    jobId: application.jobId,
    applyUrl: url.toString(),
    answerRevision: application.answerRevision,
    approvalId: application.approvalId,
    answers: input.answers,
  };
}

export function pauseReasonForEncounter(encounter: string): PauseReason | null {
  const normalized = encounter.trim().toLocaleLowerCase();
  const mapping: Record<string, PauseReason> = {
    captcha: "captcha",
    mfa: "mfa",
    assessment: "assessment",
    "legal attestation": "legal_attestation",
    "demographic question": "demographic_question",
    "salary ambiguity": "salary_ambiguity",
    "missing answer": "missing_answer",
    linkedin: "linkedin_application",
  };
  return mapping[normalized] ?? null;
}
