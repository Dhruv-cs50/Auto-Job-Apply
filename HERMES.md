# Hermes Agent project instructions

This repository builds a private, human-supervised job discovery and application system. Hermes Agent is the optional orchestration layer for engineering and scheduled discovery runs; the application database remains the source of truth.

## Working rules

- Read `docs/ARCHITECTURE.md` before changing workflow boundaries.
- Delegate independent tasks to specialized child agents, capped at three concurrent children and two levels of nesting.
- Use isolated worktrees for delegated code changes and review every child result before integration.
- Make small, coherent Git commits. Never push or deploy without explicit approval.
- Run tests, lint, and build before declaring a slice complete.
- Do not commit secrets, cookies, resumes, or raw personal data.

## Product safety and source policy

- Use LinkedIn only through user-provided links or job-alert emails; never scrape or automate authenticated LinkedIn.
- Use Jobright only through an authorized export, notification, documented integration, or user-provided link.
- Do not fabricate qualifications or application answers.
- Require per-application approval before submission.
- Stop for CAPTCHA, MFA, assessments, attestations, demographic questions, or unanswered fields.

## Architecture

- The Site dashboard and D1 database own durable state.
- Hermes coordinates bounded tasks and calls child agents; a Hermes gateway restart must not lose business state.
- Browser workers operate on a separate isolated VM and must never automate LinkedIn.
- Every external write is idempotent and every application transition is auditable.

To begin the remaining implementation, run `npm run hermes:orchestrate` after installing and configuring Hermes.
