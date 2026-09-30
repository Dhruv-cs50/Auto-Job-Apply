# Discovery container and browser VM operations

## Safety boundary

The dashboard and D1 are the durable source of truth. The scheduler only requests a run and reads it back; Hermes sessions and worker containers are disposable and are never the ledger. External writes require idempotency keys, and application changes and receipts must be auditable D1 events.

- LinkedIn input is limited to user-provided links and job-alert emails. Never log in, scrape, browse, or apply on LinkedIn with automation.
- Jobright input is limited to an authorized export, notification, documented integration, or user-provided link. Never use private endpoints, scraping, or browser cookies.
- Browser work pauses and hands control to a person for CAPTCHA, MFA, assessments, legal attestations, demographic questions, salary ambiguity, missing answers, or a changed site.
- Answers come only from verified profile facts or explicit user answers. Every submission requires approval for the exact current answer revision.

These restrictions are machine-readable in `workers/scheduler/lib.mjs` and `deploy/browser/policy.json`.

## Required control-plane contract

Before enabling either unit, the private dashboard must expose service-authenticated endpoints. The deployment artifacts deliberately do not bypass this control plane:

1. `POST /internal/discovery/runs` accepts the scheduler body and `Idempotency-Key`, atomically creates or returns the matching D1 `discovery_runs` row, and returns `202 { "runId": "...", "statusUrl": "/internal/discovery/runs/..." }`.
2. `GET` on `statusUrl` reads that row and returns `{ "runId": "...", "status": "queued|running|succeeded|failed" }`.
3. Browser claim/result endpoints use short leases and idempotent writes. Claims include the approval ID and answer revision. Results persist policy handoffs as `paused` before acknowledging the worker.

The scheduler rejects cross-origin readback and succeeds only after the D1-backed record matches. Do not point it at Hermes. The dashboard may invoke Hermes after creating the D1 row and must recover interrupted work from D1.

## Validate and build discovery

From the repository root:

```sh
node --test workers/scheduler/run.test.mjs
SCHEDULER_TRIGGER_URL=https://dashboard.invalid/internal/discovery/runs \
SCHEDULER_TOKEN_FILE=/path/to/test-token node workers/scheduler/run.mjs --check
docker build -f deploy/discovery/Dockerfile -t auto-job-discovery:test .
```

`--check` validates configuration and the mounted token without network access. Never bake tokens, cookies, resumes, application payloads, or personal data into images.

## Discovery container host

Use a private Linux host with Docker and outbound access only to the private dashboard. Create a dedicated `auto-job-control` Docker network and enforce egress separately. Install the discovery service/timer under the host's systemd unit directory. The supplied timer runs daily at 7:00 AM America/Los_Angeles. Put the example environment settings at `/opt/auto-job-apply/config/discovery.env` with mode `0600`, replace the example image with an immutable digest, and have the platform secret manager materialize a short-lived token at `/run/secrets/auto-job-apply/scheduler-token` with mode `0400`.

Run `systemd-analyze verify` on both units. Manually run the service, inspect its JSON output and matching D1 row, and only then create the root-owned `discovery.enabled` marker and enable the timer. The randomized persistent timer can catch a missed schedule; duplicate starts within one slot share a deterministic idempotency key. Alert on failed units, missing expected D1 runs, expired leases, policy rejection, and warning spikes. Stop the timer and remove the marker to prevent new work; retain D1 rows during recovery. Periodically clean up stopped anonymous containers according to host policy.

## Isolated browser VM

Run the browser worker on a separate VM from the dashboard, Hermes gateway, and scheduler. Give it no public inbound ports, cloud metadata access, host Docker socket, or persistent browser profile. Permit outbound access only to the private dashboard and approved ATS hosts. Deny LinkedIn domains at DNS/firewall level in addition to the policy file. Use a non-administrator VM identity and encrypted ephemeral disks.

This repository supplies a hardened systemd wrapper and policy, not a browser-worker image. Install `auto-job-browser.service`; put `browser.env` and the root-owned read-only policy at `/opt/auto-job-apply/config/`; materialize the worker token under `/run/secrets/auto-job-apply/`; and create `browser.enabled` only after conformance tests pass. Pin the image by digest.

The worker must fail closed if policy is absent or invalid, verify current D1 approval before navigation and immediately before submission, reject LinkedIn including redirects, heartbeat leased work, and persist its pause/failure/submission result before acknowledging. A human resume creates a new queued command; automation never solves or bypasses a challenge.

## Incident and maintenance runbook

1. **Contain:** remove the relevant enabled marker, stop its unit/timer, and revoke the service token. Preserve D1 audit rows.
2. **Inspect:** correlate slot/idempotency key, D1 events, command ID, image digest, and redacted logs. Treat cookies, form values, and tokens as secrets; do not place them in tickets or Hermes prompts.
3. **Recover:** fix policy or adapter code, rotate exposed credentials, deploy a new immutable digest, and resume from D1—not from a Hermes transcript or container filesystem.
4. **Verify:** run one manual discovery slot or non-submitting browser canary and read back D1 before restoring the marker/timer.
5. **Upgrade:** review the image SBOM and vulnerability scan, run scheduler and browser-policy tests, canary, then update the digest. Roll back to the prior digest; schema rollback is a separate reviewed operation.

Back up D1 under the provider retention policy and test restoration in isolation. Logs contain identifiers, statuses, durations, and error codes only; redact authorization headers, source payloads, answers, demographics, and page content.
