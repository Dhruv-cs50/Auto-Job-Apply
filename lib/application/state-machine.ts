export type ApplicationStatus =
  | "draft"
  | "ready_for_review"
  | "approved"
  | "queued"
  | "in_progress"
  | "paused"
  | "submitted"
  | "failed"
  | "withdrawn";

export type PauseReason =
  | "captcha"
  | "mfa"
  | "assessment"
  | "legal_attestation"
  | "demographic_question"
  | "salary_ambiguity"
  | "missing_answer"
  | "linkedin_application"
  | "site_changed"
  | "user_requested";

export type ApplicationSnapshot = {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  answerRevision: number;
  approvedAnswerRevision: number | null;
  approvalId: string | null;
  approvedAt: string | null;
  blockedReason: PauseReason | null;
  submittedAt: string | null;
  confirmationReference: string | null;
};

export type ApplicationEvent =
  | { type: "answers_updated"; revision: number }
  | { type: "review_requested" }
  | { type: "approved"; approvalId: string; approvedAt: string; answerRevision: number }
  | { type: "queued" }
  | { type: "worker_started" }
  | { type: "worker_paused"; reason: PauseReason }
  | { type: "resumed" }
  | { type: "submitted"; submittedAt: string; confirmationReference: string }
  | { type: "failed" }
  | { type: "withdrawn" };

export class InvalidApplicationTransition extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidApplicationTransition";
  }
}

function requireStatus(snapshot: ApplicationSnapshot, allowed: ApplicationStatus[], event: string) {
  if (!allowed.includes(snapshot.status)) {
    throw new InvalidApplicationTransition(`${event} is not allowed from ${snapshot.status}.`);
  }
}

export function transitionApplication(
  snapshot: ApplicationSnapshot,
  event: ApplicationEvent,
): ApplicationSnapshot {
  switch (event.type) {
    case "answers_updated":
      if (event.revision <= snapshot.answerRevision) {
        throw new InvalidApplicationTransition("Answer revisions must increase monotonically.");
      }
      requireStatus(snapshot, ["draft", "ready_for_review", "approved", "paused", "failed"], event.type);
      return {
        ...snapshot,
        status: "draft",
        answerRevision: event.revision,
        approvedAnswerRevision: null,
        approvalId: null,
        approvedAt: null,
        blockedReason: null,
      };
    case "review_requested":
      requireStatus(snapshot, ["draft", "failed"], event.type);
      return { ...snapshot, status: "ready_for_review", blockedReason: null };
    case "approved":
      requireStatus(snapshot, ["ready_for_review"], event.type);
      if (event.answerRevision !== snapshot.answerRevision) {
        throw new InvalidApplicationTransition("Approval must cover the current answer revision.");
      }
      return {
        ...snapshot,
        status: "approved",
        approvedAnswerRevision: event.answerRevision,
        approvalId: event.approvalId,
        approvedAt: event.approvedAt,
        blockedReason: null,
      };
    case "queued":
      requireStatus(snapshot, ["approved"], event.type);
      if (!snapshot.approvalId || snapshot.approvedAnswerRevision !== snapshot.answerRevision) {
        throw new InvalidApplicationTransition("The exact current answer revision must be approved before queueing.");
      }
      return { ...snapshot, status: "queued" };
    case "worker_started":
      requireStatus(snapshot, ["queued"], event.type);
      return { ...snapshot, status: "in_progress", blockedReason: null };
    case "worker_paused":
      requireStatus(snapshot, ["queued", "in_progress"], event.type);
      return { ...snapshot, status: "paused", blockedReason: event.reason };
    case "resumed":
      requireStatus(snapshot, ["paused"], event.type);
      if (!snapshot.approvalId || snapshot.approvedAnswerRevision !== snapshot.answerRevision) {
        throw new InvalidApplicationTransition("A paused application needs approval for its current answers before resuming.");
      }
      return { ...snapshot, status: "queued", blockedReason: null };
    case "submitted":
      requireStatus(snapshot, ["in_progress"], event.type);
      return {
        ...snapshot,
        status: "submitted",
        submittedAt: event.submittedAt,
        confirmationReference: event.confirmationReference,
        blockedReason: null,
      };
    case "failed":
      requireStatus(snapshot, ["queued", "in_progress"], event.type);
      return { ...snapshot, status: "failed" };
    case "withdrawn":
      requireStatus(snapshot, ["draft", "ready_for_review", "approved", "queued", "paused", "failed"], event.type);
      return { ...snapshot, status: "withdrawn", blockedReason: null };
  }
}
