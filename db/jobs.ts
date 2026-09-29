import { env } from "cloudflare:workers";
import { isFreshPosting, sortJobsByPriority } from "@/lib/priority";

export type StoredJob = {
  id: string;
  source: string;
  sourceJobId: string;
  url: string;
  company: string;
  title: string;
  location: string;
  postedAt: string | null;
  discoveredAt: string;
  fitScore: number;
  fitExplanation: string;
  status: string;
  nextAction: string;
};

type JobRow = {
  id: string;
  source: string;
  source_job_id: string;
  url: string;
  company: string;
  title: string;
  location: string;
  posted_at: string | null;
  discovered_at: string;
  fit_score: number;
  fit_explanation: string;
  status: string;
  next_action: string;
};

function database(): D1Database {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

function mapJob(row: JobRow): StoredJob {
  return {
    id: row.id,
    source: row.source,
    sourceJobId: row.source_job_id,
    url: row.url,
    company: row.company,
    title: row.title,
    location: row.location,
    postedAt: row.posted_at,
    discoveredAt: row.discovered_at,
    fitScore: row.fit_score,
    fitExplanation: row.fit_explanation,
    status: row.status,
    nextAction: row.next_action,
  };
}

export async function listPriorityJobs(limit = 50): Promise<Array<StoredJob & { fresh: boolean }>> {
  const result = await database().prepare(`
    SELECT id, source, source_job_id, url, company, title, location, posted_at,
           discovered_at, fit_score, fit_explanation, status, next_action
    FROM job_listings
    WHERE status != 'archived'
    ORDER BY fit_score DESC, posted_at DESC
    LIMIT ?
  `).bind(Math.max(limit * 4, 100)).all<JobRow>();

  return sortJobsByPriority(result.results.map(mapJob))
    .slice(0, limit)
    .map((job) => ({ ...job, fresh: isFreshPosting(job.postedAt) }));
}

export async function upsertJob(job: StoredJob): Promise<void> {
  await database().prepare(`
    INSERT INTO job_listings (
      id, source, source_job_id, url, company, title, location, posted_at,
      discovered_at, fit_score, fit_explanation, status, next_action, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(source, source_job_id) DO UPDATE SET
      url = excluded.url,
      company = excluded.company,
      title = excluded.title,
      location = excluded.location,
      posted_at = excluded.posted_at,
      fit_score = excluded.fit_score,
      fit_explanation = excluded.fit_explanation,
      status = excluded.status,
      next_action = excluded.next_action,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    job.id,
    job.source,
    job.sourceJobId,
    job.url,
    job.company,
    job.title,
    job.location,
    job.postedAt,
    job.discoveredAt,
    job.fitScore,
    job.fitExplanation,
    job.status,
    job.nextAction,
  ).run();
}
