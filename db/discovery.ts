import { env } from "cloudflare:workers";
import { upsertJob } from "@/db/jobs";
import type { AdapterResult } from "@/workers/discovery/types";

function database(): D1Database {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

export async function persistDiscoveryResult(input: {
  ownerId: string;
  result: AdapterResult;
}): Promise<{ runId: string; stored: number }> {
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  await database().prepare(`
    INSERT INTO discovery_runs (id, owner_id, started_at, status, source_counts_json)
    VALUES (?, ?, ?, 'running', '{}')
  `).bind(runId, input.ownerId, startedAt).run();

  let stored = 0;
  try {
    for (const record of input.result.records) {
      await upsertJob({
        id: crypto.randomUUID(),
        source: record.sourceKind,
        sourceJobId: record.externalJobId,
        url: record.applyUrl ?? record.sourceUrl,
        company: record.company,
        title: record.title,
        location: record.location,
        description: record.description,
        postedAt: record.postedAt.value,
        discoveredAt: record.observedAt,
        fitScore: 0,
        fitExplanation: "Awaiting an owner-scoped fit assessment.",
        status: "discovered",
        nextAction: record.description
          ? "Review requirements and fit summary"
          : "Open source listing to complete the description",
      });
      stored += 1;
    }

    await database().prepare(`
      UPDATE discovery_runs
      SET completed_at = ?, status = 'succeeded', source_counts_json = ?
      WHERE id = ? AND owner_id = ?
    `).bind(
      new Date().toISOString(),
      JSON.stringify({ fetched: input.result.records.length, stored, warnings: input.result.warnings.length }),
      runId,
      input.ownerId,
    ).run();
    return { runId, stored };
  } catch (error) {
    await database().prepare(`
      UPDATE discovery_runs
      SET completed_at = ?, status = 'failed', source_counts_json = ?, error_summary = ?
      WHERE id = ? AND owner_id = ?
    `).bind(
      new Date().toISOString(),
      JSON.stringify({ fetched: input.result.records.length, stored }),
      error instanceof Error ? error.message.slice(0, 500) : "Unknown persistence error",
      runId,
      input.ownerId,
    ).run();
    throw error;
  }
}
