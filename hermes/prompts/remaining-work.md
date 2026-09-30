# Auto Job Apply — Hermes orchestration assignment

You are the parent engineering orchestrator for this repository. First read `HERMES.md`, `README.md`, and `docs/ARCHITECTURE.md`. Inspect the working tree before making changes.

The repository already contains authenticated candidate profiles, verified-fact scoring, policy-compliant discovery adapters, authenticated discovery persistence, an approval-gated application state machine, browser-worker contracts, D1 migrations, and unit tests. Do not recreate them.

Use `delegate_task(tasks=[...])` to run these independent remaining workstreams in parallel:

1. evidence-backed job-requirement extraction contracts plus fit-assessment persistence, limited to new files under `lib/requirements/**`, `db/assessments.ts`, and `tests/requirements-*.test.ts`;
2. application persistence and authenticated transition API support, limited to new files under `db/applications.ts`, `app/api/applications/**`, and `tests/application-persistence-*.test.ts`;
3. VM/container scheduling and operations, limited to new files under `workers/scheduler/**`, `deploy/**`, and `docs/DEPLOYMENT.md`;
4. a read-only security and integration review of the completed repository; this agent must not edit files.

Give each child the exact non-overlapping scope above and require tests where code is added. Call `delegate_task` directly; do not manually create Git worktrees. This checkout has already timed out while creating worktrees, so use the shared directory and keep schema, migrations, package files, dashboard files, and shared documentation owned by the parent. The parent must review all results, resolve overlap, run the complete verification suite, and make small coherent commits. Do not push, deploy, install software, create cloud resources, or store credentials without explicit user approval.

Hard constraints:

- LinkedIn may only be sourced from user-provided links and daily alert emails. Never scrape or automate authenticated LinkedIn pages.
- Jobright may only use an authorized export, notification email, documented feed/API, or user-provided link. Never reverse-engineer private endpoints.
- Never fabricate candidate qualifications or answers.
- Never submit an application until the user has approved that application and its answers.
- Pause on CAPTCHA, MFA, assessments, legal attestations, demographic questions, salary ambiguity, or missing answers.
- Keep credentials, cookies, resume files, and personally identifying raw data out of Git and logs.
- Keep D1 as the durable system of record. Hermes runs coordinate work; they are not the application ledger.
- Preserve the strict priority policy: trustworthy postings from the last 24 hours first, then fit score, then posting time. Unknown publication dates must not be labeled as recently posted.

Start by reporting the planned delegation graph. Then delegate, integrate, verify, and report exactly what changed and what remains blocked.
