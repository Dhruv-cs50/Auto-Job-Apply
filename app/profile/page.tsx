import { ArrowLeft, BriefcaseBusiness, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { getProfileByOwner } from "@/db/profiles";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function CandidateProfilePage() {
  const user = await requireChatGPTUser("/profile");
  const profile = await getProfileByOwner(user.userId).catch(() => null);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><BriefcaseBusiness size={18} /></div>
        <div><p className="brand-name">Job Application Command Center</p><p className="brand-meta">Candidate profile</p></div>
        <div className="topbar-actions"><Link className="profile-back-link" href="/"><ArrowLeft size={15} /> Back to dashboard</Link></div>
      </header>
      <section className="profile-workspace">
        <div className="profile-page-heading">
          <div><p className="eyebrow">Private workspace</p><h1>Build your source of truth</h1><p className="heading-copy">The recommendation engine will compare job requirements with the verified information saved here.</p></div>
          <div className="profile-guardrail"><ShieldCheck size={18} /><span><strong>Verification guardrail</strong> Résumé text never silently becomes an application answer.</span></div>
        </div>
        <ProfileForm initialProfile={profile} defaultDisplayName={user.displayName} />
      </section>
    </main>
  );
}
