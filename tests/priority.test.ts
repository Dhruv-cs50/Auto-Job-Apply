import assert from "node:assert/strict";
import test from "node:test";
import { compareJobPriority, isFreshPosting, sortJobsByPriority } from "../lib/priority.ts";

const now = new Date("2026-09-29T18:00:00.000Z");

test("a posting exactly 24 hours old is fresh", () => {
  assert.equal(isFreshPosting("2026-09-28T18:00:00.000Z", now), true);
});

test("future, invalid, and missing timestamps are not fresh", () => {
  assert.equal(isFreshPosting("2026-09-29T18:00:00.001Z", now), false);
  assert.equal(isFreshPosting("not-a-date", now), false);
  assert.equal(isFreshPosting(null, now), false);
});

test("fresh jobs outrank higher-scoring old jobs", () => {
  const jobs = [
    { id: "old", fitScore: 100, postedAt: "2026-09-20T18:00:00.000Z" },
    { id: "fresh", fitScore: 50, postedAt: "2026-09-29T17:00:00.000Z" },
  ];

  assert.deepEqual(sortJobsByPriority(jobs, now).map((job) => job.id), ["fresh", "old"]);
});

test("fit score and then posting time break ties inside a freshness bucket", () => {
  const jobs = [
    { id: "lower", fitScore: 70, postedAt: "2026-09-29T17:30:00.000Z" },
    { id: "older", fitScore: 80, postedAt: "2026-09-29T16:00:00.000Z" },
    { id: "newer", fitScore: 80, postedAt: "2026-09-29T17:00:00.000Z" },
  ];

  assert.deepEqual(sortJobsByPriority(jobs, now).map((job) => job.id), ["newer", "older", "lower"]);
  assert.equal(compareJobPriority(jobs[1], jobs[2], now) > 0, true);
});
