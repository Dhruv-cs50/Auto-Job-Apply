import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getProfileByOwner, upsertProfile } from "@/db/profiles";
import { candidateProfileInputSchema } from "@/lib/candidate-profile";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    return NextResponse.json({ profile: await getProfileByOwner(user.userId) });
  } catch (error) {
    console.error("Unable to load candidate profile", error);
    return NextResponse.json({ error: "Your profile is temporarily unavailable." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const parsed = candidateProfileInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid profile", issues: parsed.error.issues }, { status: 400 });
    }
    const profile = await upsertProfile(user.userId, parsed.data);
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Unable to save candidate profile", error);
    return NextResponse.json({ error: "Your profile could not be saved." }, { status: 503 });
  }
}
