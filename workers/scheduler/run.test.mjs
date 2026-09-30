import assert from "node:assert/strict";
import { chmod, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { idempotencyKey, OPERATION_POLICY, schedulerConfig, slotFor, triggerDiscovery } from "./lib.mjs";

async function tokenFile() {
  const path = join(tmpdir(), `scheduler-token-${crypto.randomUUID()}`);
  await writeFile(path, "test-token\n", { mode: 0o600 });
  return path;
}

test("configuration requires HTTPS except explicit localhost testing", () => {
  assert.throws(() => schedulerConfig({ SCHEDULER_TRIGGER_URL: "http://example.com/run", SCHEDULER_TOKEN_FILE: "/x" }), /HTTPS/);
  assert.equal(schedulerConfig({ SCHEDULER_TRIGGER_URL: "http://127.0.0.1/run", SCHEDULER_TOKEN_FILE: "/x", SCHEDULER_ALLOW_INSECURE_LOCALHOST: "1" }).triggerUrl.hostname, "127.0.0.1");
});

test("token files with group or public access are rejected", async () => {
  const path = await tokenFile();
  await chmod(path, 0o644);
  await assert.rejects(
    () => triggerDiscovery({ triggerUrl: new URL("https://dashboard.example/internal/discovery/runs"), tokenFile: path, scheduleId: "hourly", slotMinutes: 60, timeoutMs: 1000, attempts: 1 }),
    /must not be accessible/,
  );
});

test("slots and idempotency keys are deterministic", () => {
  const slot = slotFor(new Date("2026-09-29T18:44:00.000Z"), 60);
  assert.equal(slot, "2026-09-29T18:00:00.000Z");
  assert.equal(idempotencyKey("hourly", slot), idempotencyKey("hourly", slot));
});

test("policy includes source restrictions and all mandatory handoffs", () => {
  assert.deepEqual(OPERATION_POLICY.sources.linkedin.allow, ["alert_email", "user_link"]);
  assert.ok(OPERATION_POLICY.sources.linkedin.deny.includes("authenticated_browser"));
  assert.deepEqual(OPERATION_POLICY.sources.jobright.allow, ["user_export", "notification_email", "documented_api", "user_link"]);
  for (const reason of ["captcha", "mfa", "assessment", "legal_attestation", "demographic_question", "salary_ambiguity", "missing_answer"]) assert.ok(OPERATION_POLICY.requireHumanHandoff.includes(reason));
});

test("trigger verifies the D1-backed run using same-origin readback", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    if (init.method === "POST") return Response.json({ runId: "run-1", statusUrl: "/internal/discovery/runs/run-1" }, { status: 202 });
    return Response.json({ runId: "run-1", status: "queued" });
  };
  const result = await triggerDiscovery({ triggerUrl: new URL("https://dashboard.example/internal/discovery/runs"), tokenFile: await tokenFile(), scheduleId: "hourly", slotMinutes: 60, timeoutMs: 1000, attempts: 1 }, { fetchImpl, now: new Date("2026-09-29T18:44:00.000Z") });
  assert.deepEqual(result, { runId: "run-1", status: "queued", scheduledSlot: "2026-09-29T18:00:00.000Z" });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.headers["idempotency-key"], idempotencyKey("hourly", result.scheduledSlot));
});

test("trigger rejects cross-origin readback", async () => {
  const token = await tokenFile();
  await assert.rejects(() => triggerDiscovery({ triggerUrl: new URL("https://dashboard.example/internal/discovery/runs"), tokenFile: token, scheduleId: "hourly", slotMinutes: 60, timeoutMs: 1000, attempts: 1 }, { fetchImpl: async () => Response.json({ runId: "run-1", statusUrl: "https://attacker.example/run-1" }, { status: 202 }) }), /Cross-origin/);
});
