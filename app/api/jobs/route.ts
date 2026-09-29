import { NextResponse } from "next/server";
import { z } from "zod";
import { listPriorityJobs, upsertJob } from "@/db/jobs";

const jobInput = z.object({
  id: z.string().min(1).max(200),
  source: z.enum(["jobright", "linkedin_alert", "greenhouse", "lever", "company_site"]),
  sourceJobId: z.string().min(1).max(300),
  url: z.string().url(),
  company: z.string().min(1).max(200),
  title: z.string().min(1).max(240),
  location: z.string().max(240).default(""),
  description: z.string().max(100_000).default(""),
  postedAt: z.string().datetime().nullable(),
  discoveredAt: z.string().datetime(),
  fitScore: z.number().int().min(0).max(100),
  fitExplanation: z.string().max(2000).default(""),
  status: z.enum(["discovered", "ready_to_review", "approved", "submitted", "needs_answer", "archived"]),
  nextAction: z.string().max(300),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 50;

  try {
    return NextResponse.json({ jobs: await listPriorityJobs(limit) });
  } catch (error) {
    console.error("Unable to list priority jobs", error);
    return NextResponse.json({ error: "Job data is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = jobInput.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid job payload", issues: parsed.error.issues }, { status: 400 });
    }

    await upsertJob(parsed.data);
    return NextResponse.json({ id: parsed.data.id, status: "stored" }, { status: 201 });
  } catch (error) {
    console.error("Unable to store job", error);
    return NextResponse.json({ error: "The job could not be stored." }, { status: 503 });
  }
}
