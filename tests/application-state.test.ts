import assert from "node:assert/strict";
import test from "node:test";
import {
  InvalidApplicationTransition,
  transitionApplication,
  type ApplicationSnapshot,
} from "../lib/application/state-machine.ts";
import {
  createSubmissionCommand,
  pauseReasonForEncounter,
  SubmissionGuardError,
} from "../workers/browser/contracts.ts";

const draft: ApplicationSnapshot = {
  id: "application-1",
  jobId: "job-1",
  status: "draft",
  answerRevision: 1,
  approvedAnswerRevision: null,
  approvalId: null,
  approvedAt: null,
  blockedReason: null,
  submittedAt: null,
  confirmationReference: null,
};

test("the exact answer revision must be reviewed and approved before queueing", () => {
  const ready = transitionApplication(draft, { type: "review_requested" });
  assert.throws(
    () => transitionApplication(ready, { type: "approved", approvalId: "approval-1", approvedAt: "2026-09-29T18:00:00.000Z", answerRevision: 0 }),
    InvalidApplicationTransition,
  );
  const approved = transitionApplication(ready, { type: "approved", approvalId: "approval-1", approvedAt: "2026-09-29T18:00:00.000Z", answerRevision: 1 });
  assert.equal(transitionApplication(approved, { type: "queued" }).status, "queued");
});

test("editing answers invalidates approval", () => {
  const approved = transitionApplication(
    transitionApplication(draft, { type: "review_requested" }),
    { type: "approved", approvalId: "approval-1", approvedAt: "2026-09-29T18:00:00.000Z", answerRevision: 1 },
  );
  const changed = transitionApplication(approved, { type: "answers_updated", revision: 2 });
  assert.equal(changed.status, "draft");
  assert.equal(changed.approvalId, null);
  assert.equal(changed.approvedAnswerRevision, null);
});

test("browser commands require approval and reject LinkedIn", () => {
  assert.throws(() => createSubmissionCommand({ application: draft, applyUrl: "https://jobs.example.com/1", answers: [], idempotencyKey: "key" }), SubmissionGuardError);
  const approved = transitionApplication(
    transitionApplication(draft, { type: "review_requested" }),
    { type: "approved", approvalId: "approval-1", approvedAt: "2026-09-29T18:00:00.000Z", answerRevision: 1 },
  );
  assert.throws(() => createSubmissionCommand({ application: approved, applyUrl: "https://www.linkedin.com/jobs/view/1", answers: [], idempotencyKey: "key" }), SubmissionGuardError);
  const command = createSubmissionCommand({
    application: approved,
    applyUrl: "https://boards.greenhouse.io/acme/jobs/1",
    answers: [{ field: "name", value: "Dhruv Shah", source: "verified_profile" }],
    idempotencyKey: "application-1:revision-1",
    commandId: "command-1",
  });
  assert.equal(command.approvalId, "approval-1");
  assert.equal(command.answerRevision, 1);
});

test("sensitive encounters always map to a pause reason", () => {
  for (const encounter of ["captcha", "mfa", "assessment", "legal attestation", "demographic question", "salary ambiguity", "missing answer", "linkedin"]) {
    assert.notEqual(pauseReasonForEncounter(encounter), null);
  }
});
