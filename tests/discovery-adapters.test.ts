import assert from "node:assert/strict";
import test from "node:test";
import { ingestGreenhousePayload } from "../workers/discovery/adapters/greenhouse.ts";
import { ingestLeverPayload } from "../workers/discovery/adapters/lever.ts";
import { ingestLinkedInAlert } from "../workers/discovery/adapters/linkedin-alert.ts";
import { ingestJobrightRecords } from "../workers/discovery/adapters/jobright.ts";
import { canonicalizeJobUrl, stableCompositeKey } from "../workers/discovery/normalization.ts";
import { DiscoveryPolicyError } from "../workers/discovery/types.ts";

const observedAt = "2026-09-29T18:00:00.000Z";

test("Greenhouse keeps updated_at as provenance, not publication time", () => {
  const result = ingestGreenhousePayload({
    boardToken: "acme",
    company: "Acme",
    sourceConfigId: "source-1",
    observedAt,
    payload: { jobs: [{ id: 42, absolute_url: "https://boards.greenhouse.io/acme/jobs/42?gh_src=alert", title: "Data Scientist", location: { name: "Remote" }, content: "<p>Build models</p>", updated_at: observedAt }] },
  });
  assert.equal(result.records[0].postedAt.value, null);
  assert.equal(result.records[0].metadata.sourceUpdatedAt, observedAt);
  assert.equal(result.records[0].sourceUrl, "https://boards.greenhouse.io/acme/jobs/42");
});

test("Lever public payloads remain unknown-date complete snapshots", () => {
  const result = ingestLeverPayload({
    siteToken: "acme",
    company: "Acme",
    sourceConfigId: "source-2",
    observedAt,
    payload: [{ id: "abc", text: "ML Engineer", hostedUrl: "https://jobs.lever.co/acme/abc", descriptionPlain: "Build systems", categories: { location: "San Jose" } }],
  });
  assert.equal(result.completeSnapshot, true);
  assert.equal(result.records[0].postedAt.value, null);
});

test("LinkedIn alert dates are anchored to the email header", () => {
  const result = ingestLinkedInAlert({
    mode: "alert_email",
    sourceConfigId: "source-3",
    observedAt,
    payload: { messageId: "message-1", sentAt: observedAt, jobs: [{ url: "https://www.linkedin.com/jobs/view/1?utm_source=email", title: "Analyst", company: "City", location: "Oakland", snippet: "Analyze routes", postedLabel: "3 hours ago" }] },
  });
  assert.equal(result.records[0].postedAt.value, "2026-09-29T15:00:00.000Z");
  assert.equal(result.completeSnapshot, false);
});

test("authenticated LinkedIn and private Jobright modes are blocked", () => {
  assert.throws(() => ingestLinkedInAlert({ mode: "authenticated_browser", sourceConfigId: "x", observedAt, payload: {} }), DiscoveryPolicyError);
  assert.throws(() => ingestJobrightRecords({ authorization: "private_endpoint", sourceConfigId: "x", observedAt, payload: [] }), DiscoveryPolicyError);
  assert.throws(() => ingestJobrightRecords({ authorization: "browser_cookie", sourceConfigId: "x", observedAt, payload: [] }), DiscoveryPolicyError);
});

test("Jobright authorized exports preserve explicit timestamps and provenance", () => {
  const result = ingestJobrightRecords({
    authorization: "user_export",
    sourceConfigId: "source-4",
    observedAt,
    payload: [{ id: "jr-1", url: "https://jobright.ai/jobs/1?source=export", company: "Acme", title: "Scientist", location: "Remote", postedAt: "2026-09-29T17:00:00.000Z" }],
  });
  assert.equal(result.records[0].postedAt.value, "2026-09-29T17:00:00.000Z");
  assert.equal(result.records[0].metadata.authorization, "user_export");
});

test("URL and composite normalization are deterministic", () => {
  assert.equal(canonicalizeJobUrl("https://example.com/job/1?utm_source=x&b=2&a=1#top"), "https://example.com/job/1?a=1&b=2");
  assert.notEqual(stableCompositeKey(["ab", "c"]), stableCompositeKey(["a", "bc"]));
});
