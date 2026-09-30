"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StoredCandidateProfile } from "@/db/profiles";

type Props = {
  initialProfile: StoredCandidateProfile | null;
  defaultDisplayName: string;
};

const join = (values: string[]) => values.join(", ");
const split = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export function ProfileForm({ initialProfile, defaultDisplayName }: Props) {
  const defaults = useMemo(() => ({
    displayName: initialProfile?.displayName ?? defaultDisplayName,
    headline: initialProfile?.headline ?? "",
    resumeText: initialProfile?.resumeText ?? "",
    targetTitles: join(initialProfile?.preferences.targetTitles ?? []),
    preferredLocations: join(initialProfile?.preferences.preferredLocations ?? []),
    remotePreference: initialProfile?.preferences.remotePreference ?? "flexible",
    minimumSalary: initialProfile?.preferences.minimumSalary?.toString() ?? "",
    verifiedSkills: join(initialProfile?.verifiedFacts.verifiedSkills ?? []),
    verifiedYearsExperience: initialProfile?.verifiedFacts.verifiedYearsExperience?.toString() ?? "",
    verifiedDegrees: join(initialProfile?.verifiedFacts.verifiedDegrees ?? []),
    workAuthorization: initialProfile?.verifiedFacts.workAuthorization ?? "prefer_not_to_say",
    requiresSponsorship:
      initialProfile?.verifiedFacts.requiresSponsorship === null || initialProfile?.verifiedFacts.requiresSponsorship === undefined
        ? "unknown"
        : initialProfile.verifiedFacts.requiresSponsorship ? "yes" : "no",
  }), [initialProfile, defaultDisplayName]);
  const [form, setForm] = useState(defaults);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  const update = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setState("idle");
  };

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: form.displayName,
        headline: form.headline,
        resumeText: form.resumeText,
        targetTitles: split(form.targetTitles),
        preferredLocations: split(form.preferredLocations),
        remotePreference: form.remotePreference,
        minimumSalary: form.minimumSalary ? Number(form.minimumSalary) : null,
        verifiedSkills: split(form.verifiedSkills),
        verifiedYearsExperience: form.verifiedYearsExperience ? Number(form.verifiedYearsExperience) : null,
        verifiedDegrees: split(form.verifiedDegrees),
        workAuthorization: form.workAuthorization,
        requiresSponsorship: form.requiresSponsorship === "unknown" ? null : form.requiresSponsorship === "yes",
      }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) {
      setState("error");
      setMessage(result.error ?? "Your profile could not be saved.");
      return;
    }
    setState("saved");
    setMessage("Profile saved. Future fit scores will use these verified facts.");
  }

  return (
    <form className="profile-form" onSubmit={save}>
      <section className="profile-card profile-intro-card">
        <div>
          <p className="eyebrow">Candidate identity</p>
          <h2>The facts employers should evaluate</h2>
          <p>Résumé text is cached for comparison, but only the facts you verify below can increase a fit score.</p>
        </div>
        <div className="profile-save-state" data-state={state}>
          {state === "saving" && <Loader2 className="animate-spin" size={16} />}
          {state === "saved" && <CheckCircle2 size={16} />}
          {message || (initialProfile ? "Last saved profile loaded" : "Not saved yet")}
        </div>
      </section>

      <div className="profile-grid">
        <section className="profile-card">
          <div className="profile-section-heading"><span>01</span><div><h2>Basics</h2><p>How you want your profile represented.</p></div></div>
          <label>Display name<Input value={form.displayName} onChange={(e) => update("displayName", e.target.value)} required /></label>
          <label>Professional headline<Input value={form.headline} onChange={(e) => update("headline", e.target.value)} placeholder="Data scientist focused on forecasting and mobility" /></label>
          <label>Target job titles<Input value={form.targetTitles} onChange={(e) => update("targetTitles", e.target.value)} placeholder="Data Scientist, ML Engineer, Applied Scientist" /><small>Separate values with commas.</small></label>
        </section>

        <section className="profile-card">
          <div className="profile-section-heading"><span>02</span><div><h2>Verified qualifications</h2><p>These are the only facts used to award fit points.</p></div></div>
          <label>Skills you can substantiate<Textarea value={form.verifiedSkills} onChange={(e) => update("verifiedSkills", e.target.value)} placeholder="Python, SQL, forecasting, scikit-learn" /></label>
          <div className="profile-two-column">
            <label>Years of relevant experience<Input type="number" min="0" max="80" step="0.5" value={form.verifiedYearsExperience} onChange={(e) => update("verifiedYearsExperience", e.target.value)} /></label>
            <label>Degree or field<Input value={form.verifiedDegrees} onChange={(e) => update("verifiedDegrees", e.target.value)} placeholder="MS Data Analytics, BS Computer Science" /></label>
          </div>
        </section>

        <section className="profile-card">
          <div className="profile-section-heading"><span>03</span><div><h2>Preferences and eligibility</h2><p>Used for hard gates and ranking—not invented answers.</p></div></div>
          <div className="profile-two-column">
            <label>Preferred locations<Input value={form.preferredLocations} onChange={(e) => update("preferredLocations", e.target.value)} placeholder="San Jose, San Francisco, Remote US" /></label>
            <label>Minimum base salary<Input type="number" min="0" value={form.minimumSalary} onChange={(e) => update("minimumSalary", e.target.value)} placeholder="120000" /></label>
            <label>Workplace preference<select value={form.remotePreference} onChange={(e) => update("remotePreference", e.target.value)}><option value="flexible">Flexible</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label>
            <label>US work authorization<select value={form.workAuthorization} onChange={(e) => update("workAuthorization", e.target.value)}><option value="prefer_not_to_say">Not answered</option><option value="authorized">Authorized</option><option value="authorized_with_expiration">Authorized with expiration</option><option value="not_authorized">Not currently authorized</option></select></label>
            <label>Sponsorship required<select value={form.requiresSponsorship} onChange={(e) => update("requiresSponsorship", e.target.value)}><option value="unknown">Not answered</option><option value="yes">Yes</option><option value="no">No</option></select></label>
          </div>
        </section>

        <section className="profile-card profile-resume-card">
          <div className="profile-section-heading"><span>04</span><div><h2>Résumé text</h2><p>Paste plain text for requirement comparison. Review extracted facts above before scoring.</p></div></div>
          <label className="resume-label">Résumé text<Textarea value={form.resumeText} onChange={(e) => update("resumeText", e.target.value)} placeholder="Paste your résumé as plain text…" rows={16} /><small>{form.resumeText.length.toLocaleString()} / 100,000 characters</small></label>
        </section>
      </div>

      <div className="profile-actions">
        <p>Saving replaces your prior cached profile. No résumé content is committed to Git.</p>
        <Button type="submit" disabled={state === "saving"}><Save />{state === "saving" ? "Saving…" : "Save candidate profile"}</Button>
      </div>
    </form>
  );
}
