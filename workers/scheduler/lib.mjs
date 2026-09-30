import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

export const OPERATION_POLICY = Object.freeze({
  durableState: "d1",
  hermesIsLedger: false,
  sources: {
    linkedin: { allow: ["alert_email", "user_link"], deny: ["authenticated_browser", "scraping", "application_automation"] },
    jobright: { allow: ["user_export", "notification_email", "documented_api", "user_link"], deny: ["private_endpoint", "browser_cookie", "scraping"] },
  },
  requireHumanHandoff: ["captcha", "mfa", "assessment", "legal_attestation", "demographic_question", "salary_ambiguity", "missing_answer"],
});

export function schedulerConfig(env = process.env) {
  const triggerUrl = new URL(required(env, "SCHEDULER_TRIGGER_URL"));
  if (triggerUrl.protocol !== "https:" && env.SCHEDULER_ALLOW_INSECURE_LOCALHOST !== "1") throw new Error("SCHEDULER_TRIGGER_URL must use HTTPS");
  if (triggerUrl.protocol !== "https:" && !["localhost", "127.0.0.1", "::1"].includes(triggerUrl.hostname)) throw new Error("Insecure scheduler URLs are limited to localhost tests");
  const scheduleId = env.SCHEDULER_ID ?? "daily-discovery";
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(scheduleId)) throw new Error("SCHEDULER_ID has an invalid format");
  return {
    triggerUrl,
    tokenFile: required(env, "SCHEDULER_TOKEN_FILE"),
    scheduleId,
    slotMinutes: integer(env.SCHEDULER_SLOT_MINUTES ?? "1440", "SCHEDULER_SLOT_MINUTES", 1, 1440),
    timeoutMs: integer(env.SCHEDULER_TIMEOUT_MS ?? "30000", "SCHEDULER_TIMEOUT_MS", 1000, 120000),
    attempts: integer(env.SCHEDULER_MAX_ATTEMPTS ?? "3", "SCHEDULER_MAX_ATTEMPTS", 1, 5),
  };
}

export function slotFor(date, slotMinutes) {
  const slotMs = slotMinutes * 60_000;
  return new Date(Math.floor(date.getTime() / slotMs) * slotMs).toISOString();
}

export function idempotencyKey(scheduleId, slot) {
  return `discovery:${scheduleId}:${createHash("sha256").update(slot).digest("hex").slice(0, 24)}`;
}

export async function loadToken(path) {
  const info = await stat(path);
  if (!info.isFile()) throw new Error("Scheduler token path must be a regular file");
  if ((info.mode & 0o077) !== 0) throw new Error("Scheduler token file must not be accessible by group or other users");
  const token = (await readFile(path, "utf8")).trim();
  if (!token) throw new Error("Scheduler token file is empty");
  return token;
}

export async function triggerDiscovery(config, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const slot = slotFor(now, config.slotMinutes);
  const key = idempotencyKey(config.scheduleId, slot);
  const token = await loadToken(config.tokenFile);
  let response;
  for (let attempt = 1; attempt <= config.attempts; attempt += 1) {
    response = await fetchImpl(config.triggerUrl, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(config.timeoutMs),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "idempotency-key": key },
      body: JSON.stringify({ scheduleId: config.scheduleId, scheduledSlot: slot, requestedAt: now.toISOString(), idempotencyKey: key, policy: OPERATION_POLICY }),
    });
    if (response.ok) break;
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === config.attempts) throw new Error(`Discovery trigger failed with HTTP ${response.status}`);
  }
  const created = await response.json();
  if (!created || typeof created.runId !== "string" || typeof created.statusUrl !== "string") throw new Error("Discovery trigger response must contain runId and statusUrl");
  const statusUrl = new URL(created.statusUrl, config.triggerUrl);
  if (statusUrl.origin !== config.triggerUrl.origin) throw new Error("Cross-origin discovery status URL is not allowed");
  const readback = await fetchImpl(statusUrl, { method: "GET", redirect: "error", signal: AbortSignal.timeout(config.timeoutMs), headers: { authorization: `Bearer ${token}` } });
  if (!readback.ok) throw new Error(`Discovery run readback failed with HTTP ${readback.status}`);
  const run = await readback.json();
  if (!run || run.runId !== created.runId || !["queued", "running", "succeeded", "failed"].includes(run.status)) throw new Error("Discovery run readback did not verify the created D1 record");
  return { runId: run.runId, status: run.status, scheduledSlot: slot };
}

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function integer(value, name, min, max) {
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be an integer`);
  const parsed = Number(value);
  if (parsed < min || parsed > max) throw new Error(`${name} must be between ${min} and ${max}`);
  return parsed;
}
