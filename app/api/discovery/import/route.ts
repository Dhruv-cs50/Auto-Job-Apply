import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { persistDiscoveryResult } from "@/db/discovery";
import { ingestGreenhousePayload } from "@/workers/discovery/adapters/greenhouse";
import { ingestJobrightRecords } from "@/workers/discovery/adapters/jobright";
import { ingestLeverPayload } from "@/workers/discovery/adapters/lever";
import { ingestLinkedInAlert } from "@/workers/discovery/adapters/linkedin-alert";
import { DiscoveryPolicyError, type AdapterResult } from "@/workers/discovery/types";

const importInputSchema = z.object({
  source: z.enum(["greenhouse", "lever", "linkedin_alert", "jobright"]),
  sourceConfigId: z.string().min(1).max(200),
  observedAt: z.string().datetime(),
  company: z.string().min(1).max(200).optional(),
  boardToken: z.string().min(1).max(160).optional(),
  siteToken: z.string().min(1).max(160).optional(),
  mode: z.enum(["alert_email", "user_link", "authenticated_browser"]).optional(),
  authorization: z.enum([
    "user_export",
    "notification_email",
    "documented_api",
    "user_link",
    "private_endpoint",
    "browser_cookie",
  ]).optional(),
  payload: z.unknown(),
});

function adapt(input: z.infer<typeof importInputSchema>): AdapterResult {
  switch (input.source) {
    case "greenhouse":
      if (!input.boardToken || !input.company) throw new Error("Greenhouse imports require boardToken and company.");
      return ingestGreenhousePayload({ ...input, boardToken: input.boardToken, company: input.company });
    case "lever":
      if (!input.siteToken || !input.company) throw new Error("Lever imports require siteToken and company.");
      return ingestLeverPayload({ ...input, siteToken: input.siteToken, company: input.company });
    case "linkedin_alert":
      if (!input.mode) throw new Error("LinkedIn imports require an approved mode.");
      return ingestLinkedInAlert({ ...input, mode: input.mode });
    case "jobright":
      if (!input.authorization) throw new Error("Jobright imports require an authorization source.");
      return ingestJobrightRecords({ ...input, authorization: input.authorization });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const parsed = importInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid discovery import", issues: parsed.error.issues }, { status: 400 });
    }
    const result = adapt(parsed.data);
    const persisted = await persistDiscoveryResult({ ownerId: user.userId, result });
    return NextResponse.json({
      ...persisted,
      accepted: result.records.length,
      completeSnapshot: result.completeSnapshot,
      warnings: result.warnings,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof DiscoveryPolicyError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
    }
    if (error instanceof z.ZodError || error instanceof Error && error.message.includes("require")) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid source payload" }, { status: 400 });
    }
    console.error("Unable to import discovery records", error);
    return NextResponse.json({ error: "Discovery records could not be imported." }, { status: 503 });
  }
}
