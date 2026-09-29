# Hermes Agent integration

Hermes Agent is integrated as an optional, separately deployed orchestrator. It is deliberately not an in-process dependency of the dashboard.

## Local engineering orchestration

1. Install Hermes from the [official installation guide](https://hermes-agent.nousresearch.com/docs/getting-started/installation/).
2. Run `hermes setup` and configure a supported model provider.
3. Merge `hermes/config.example.yaml` into `~/.hermes/config.yaml` and validate the active values.
4. Run `npm run hermes:orchestrate` from the repository root.

The committed prompt requires Hermes to call `delegate_task(tasks=[...])` and divide the remaining work among profile/scoring, discovery, application workflow, and verification agents. The parent agent reviews and integrates the results.

## Production topology

Run a version-pinned Hermes container on a private VM or private container service. Enable the authenticated API server with `API_SERVER_ENABLED=true` and a secret `API_SERVER_KEY`; do not expose its default port publicly. The backend can use `lib/hermes/client.ts` to create an idempotent run with `POST /v1/runs`, then poll `GET /v1/runs/{run_id}`.

The production scheduler should create discovery-run records in D1 before invoking Hermes. Hermes delegates bounded discovery and scoring tasks, while D1 retains job provenance, run status, application state, and receipts. Do not use Hermes session state as the ledger.

## Guardrails

- Limit concurrency and nesting explicitly; delegated work multiplies model and tool costs.
- Keep child auto-approval disabled for sensitive operations.
- Use idempotency keys for run creation.
- Require human approval before each application submission.
- Stop for CAPTCHA, MFA, assessments, attestations, and missing answers.
- Store API keys in VM/cloud secret storage, never in this repository.
- Expect in-flight runs to be interrupted by gateway restarts; retry from D1 state.

Official references: [repository](https://github.com/NousResearch/hermes-agent), [API server](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server), [delegation](https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation), [Docker](https://hermes-agent.nousresearch.com/docs/user-guide/docker), and [security](https://hermes-agent.nousresearch.com/docs/user-guide/security/).
