# Job Application Agent Architecture

## Product boundaries

The system helps one job seeker discover, rank, review, and track applications. It stores only user-provided facts and never invents qualifications. The first release requires approval before submission.

## Workflow

1. Scheduled discovery receives jobs from approved sources.
2. Jobs are normalized and deduplicated by source and source job ID.
3. A fit pipeline extracts requirements and scores the role against verified candidate facts.
4. Priority ordering uses a strict freshness bucket first: roles posted within the previous 24 hours precede older roles. Jobs inside each bucket are sorted by fit score and then posting time.
5. Approved jobs enter the browser-worker queue.
6. The worker pauses on CAPTCHA, MFA, assessments, legal attestations, or any unanswered question.
7. Submission receipts and status changes are written back to the dashboard.

## Components

- `app/`: private dashboard and ingestion API.
- `db/`: D1 schema and query boundary.
- `lib/priority.ts`: deterministic freshness and priority policy.
- Future `workers/discovery/`: scheduled source adapters and scoring.
- Future `workers/browser/`: Playwright site adapters running on a controlled VM.

## Discovery sources

- Jobright: only through an authorized export, notification feed, or documented account integration. No undocumented scraping.
- LinkedIn: daily job-alert emails or user-supplied job links. No automated access to, scraping of, or application submission on LinkedIn.
- Greenhouse, Lever, and company sites: public listings where their published interfaces and terms allow access.

## Deployment target

The dashboard is deployable as a private Site with D1. The discovery job is intended for a scheduled container, and browser automation is intended for an isolated VM with secrets stored outside the repository.
