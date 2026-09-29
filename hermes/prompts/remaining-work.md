# Auto Job Apply — Hermes orchestration assignment

You are the parent engineering orchestrator for this repository. First read `HERMES.md`, `README.md`, and `docs/ARCHITECTURE.md`. Inspect the working tree before making changes.

Use `delegate_task(tasks=[...])` to run independent work in parallel. Spawn separate agents for:

1. candidate profile, resume-text ingestion, and explainable fit scoring;
2. policy-compliant discovery adapters for Greenhouse, Lever, LinkedIn alert emails, and Jobright imports;
3. application workflow, approval gates, dashboard persistence, and browser-worker contracts;
4. tests, CI, deployment/runbooks, and security review.

Give each child a narrow file scope and require tests. Use isolated worktrees when available. The parent must review all results, resolve overlap, run the complete verification suite, and make small coherent commits. Do not push, deploy, install software, create cloud resources, or store credentials without explicit user approval.

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
