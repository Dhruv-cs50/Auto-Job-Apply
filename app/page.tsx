import {
  AlertTriangle,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  FileCheck2,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { listApplications } from "@/db/applications";
import { listPriorityJobs } from "@/db/jobs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function StatusBadge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <Badge className={`status-badge status-${tone}`}>{children}</Badge>;
}

const statusPresentation: Record<string, { label: string; tone: string }> = {
  discovered: { label: "Discovered", tone: "discovered" },
  draft: { label: "Draft", tone: "review" },
  ready_for_review: { label: "Ready to review", tone: "review" },
  approved: { label: "Approved", tone: "approved" },
  queued: { label: "Queued", tone: "approved" },
  in_progress: { label: "In progress", tone: "approved" },
  paused: { label: "Paused", tone: "blocked" },
  submitted: { label: "Submitted", tone: "submitted" },
  failed: { label: "Failed", tone: "blocked" },
  withdrawn: { label: "Withdrawn", tone: "discovered" },
};

const nextStepByStatus: Record<string, string> = {
  draft: "Complete application answers",
  ready_for_review: "Approve the exact answers",
  approved: "Queue for the browser worker",
  queued: "Waiting for the browser worker",
  in_progress: "Browser worker is running",
  paused: "Resolve the human handoff",
  submitted: "Track the employer response",
  failed: "Review the failure",
  withdrawn: "No further action",
};

const sourcePresentation: Record<string, string> = {
  jobright: "Jobright",
  linkedin_alert: "LinkedIn alert",
  greenhouse: "Greenhouse",
  lever: "Lever",
  company_site: "Company site",
};

function postedLabel(postedAt: string | null) {
  if (!postedAt) return "Posting time unknown";
  const ageHours = Math.max(0, Math.floor((Date.now() - new Date(postedAt).getTime()) / 3_600_000));
  return ageHours < 24 ? `${ageHours || 1}h ago` : `${Math.floor(ageHours / 24)}d ago`;
}

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  const [storedJobs, storedApplications] = await Promise.all([
    listPriorityJobs(25).catch(() => []),
    user ? listApplications(user.userId, 200).catch(() => []) : Promise.resolve([]),
  ]);
  const applicationByJobId = new Map(storedApplications.map((application) => [application.jobId, application]));
  const applications = storedJobs.map((job) => {
    const savedApplication = applicationByJobId.get(job.id);
    const status = savedApplication?.status ?? "discovered";
    const presentation = statusPresentation[status] ?? statusPresentation.discovered;
    return {
        id: job.id,
        company: job.company,
        role: job.title,
        location: job.location,
        source: sourcePresentation[job.source] ?? job.source,
        posted: postedLabel(job.postedAt),
        fresh: job.fresh,
        score: job.fitScore,
        status: presentation.label,
        statusKey: status,
        tone: presentation.tone,
        next: nextStepByStatus[status] ?? job.nextAction,
      };
  });
  const freshCount = applications.filter((job) => job.fresh).length;
  const reviewedCount = storedApplications.filter((application) => application.status === "ready_for_review").length;
  const pausedCount = storedApplications.filter((application) => application.status === "paused").length;
  const approvedCount = storedApplications.filter((application) => ["approved", "queued", "in_progress", "paused"].includes(application.status)).length;
  const submittedCount = storedApplications.filter((application) => application.status === "submitted").length;
  const pipeline = [
    { label: "Discovered", count: applications.length },
    { label: "Strong fit", count: applications.filter((job) => job.score >= 85).length },
    { label: "Approved or active", count: approvedCount },
    { label: "Submitted", count: submittedCount },
  ].map((step) => ({
    ...step,
    percent: applications.length ? Math.round(step.count / applications.length * 100) : 0,
  }));
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(new Date());
  const stats = [
    { label: "Fresh in last 24h", value: String(freshCount), note: "Pinned first", icon: Clock3 },
    { label: "Strong matches", value: String(applications.filter((job) => job.score >= 85).length), note: "Fit score 85+", icon: Sparkles },
    { label: "Awaiting review", value: String(reviewedCount), note: "Needs approval", icon: CalendarClock },
    { label: "Submitted", value: String(submittedCount), note: "Tracked", icon: FileCheck2 },
  ];
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><BriefcaseBusiness size={18} /></div>
        <div>
          <p className="brand-name">Job Application Command Center</p>
          <p className="brand-meta">Private workspace</p>
        </div>
        <div className="topbar-actions">
          <div className="agent-state"><span className="agent-pulse" />Agent ready</div>
          <Button variant="outline" size="sm"><Search /> Search jobs</Button>
          <Button size="sm">Review queue <ChevronRight /></Button>
        </div>
      </header>

      <div className="app-shell">
        <aside className="sidebar" aria-label="Workspace navigation">
          <nav>
            <a className="nav-item nav-active" href="#overview"><CircleDot /> Overview</a>
            <a className="nav-item" href="#applications">
              <BriefcaseBusiness /> Applications <span className="nav-count">{storedApplications.length}</span>
            </a>
            <a className="nav-item" href="#schedule"><CalendarClock /> Schedule</a>
            <a className="nav-item" href="/profile"><FileCheck2 /> Candidate profile</a>
          </nav>
          <div className="sidebar-note">
            <div className="sidebar-note-icon"><Check size={15} /></div>
            <p>Submission guardrails are on</p>
            <span>Approval is required before every application.</span>
          </div>
        </aside>

        <section className="workspace" id="overview">
          <div className="workspace-heading">
            <div>
              <p className="eyebrow">{dateLabel}</p>
              <h1>Your application pipeline</h1>
              <p className="heading-copy">
                {applications.length
                  ? `${freshCount} fresh role${freshCount === 1 ? "" : "s"} found in the last 24 hours. Fresh roles are ranked first.`
                  : "No jobs have been imported yet. Connect an approved discovery source to begin."}
              </p>
            </div>
            <div className="next-run">
              <CalendarClock size={17} />
              <span><strong>Next scan</strong> Tomorrow at 7:00 AM PT</span>
            </div>
          </div>

          <div className="stats-grid" aria-label="Application summary">
            {stats.map((stat) => (
              <article className="stat-card" key={stat.label}>
                <div className="stat-icon"><stat.icon size={18} /></div>
                <p>{stat.label}</p>
                <div className="stat-value-row"><strong>{stat.value}</strong><span>{stat.note}</span></div>
              </article>
            ))}
          </div>

          <div className="freshness-rule">
            <Clock3 size={16} />
            <span><strong>Freshness priority active</strong> Jobs posted in the last 24 hours are sorted ahead of older matches, then ordered by fit score.</span>
          </div>

          <div className="content-grid">
            <section className="panel applications-panel" id="applications">
              <div className="panel-heading">
                <div><h2>Priority applications</h2><p>Ranked by freshness, fit, and readiness.</p></div>
                <Button variant="ghost" size="sm">View all <ArrowUpRight /></Button>
              </div>
              <div className="table-wrap">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Fit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Next step</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applications.map((application) => (
                      <TableRow key={application.id}>
                        <TableCell>
                          <div className="role-cell">
                            <strong>{application.role}</strong>
                            <span>{application.company}</span>
                            <small><MapPin size={12} /> {application.location}</small>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="source-cell">
                            <span>{application.source}</span>
                            <small className={application.fresh ? "is-fresh" : ""}>{application.posted}{application.fresh && " · Fresh"}</small>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="score-cell">
                            <span className="score-number">{application.score}</span>
                            <div className="score-track"><i style={{ width: `${application.score}%` }} /></div>
                          </div>
                        </TableCell>
                        <TableCell><StatusBadge tone={application.tone}>{application.status}</StatusBadge></TableCell>
                        <TableCell><div className="next-cell"><strong>{application.next}</strong><span>Open details</span></div></TableCell>
                      </TableRow>
                    ))}
                    {!applications.length && (
                      <TableRow>
                        <TableCell className="empty-table" colSpan={5}>
                          No discovered jobs yet. Import an approved Jobright export, LinkedIn alert, Greenhouse board, or Lever feed.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>

            <aside className="right-column">
              <section className="panel attention-panel">
                <div className="panel-heading compact">
                  <div><h2>Needs attention</h2><p>{reviewedCount + pausedCount} items need a decision.</p></div>
                  <span className="attention-icon"><AlertTriangle size={17} /></span>
                </div>
                <div className="attention-list">
                  <button type="button"><span><strong>Review applications</strong><small>{reviewedCount} waiting for exact-answer approval</small></span><ChevronRight /></button>
                  <button type="button"><span><strong>Resolve human handoffs</strong><small>{pausedCount} paused for your input</small></span><ChevronRight /></button>
                  <button type="button"><span><strong>Connect discovery sources</strong><small>Jobright and LinkedIn alerts</small></span><ChevronRight /></button>
                </div>
              </section>

              <section className="panel pipeline-panel">
                <div className="panel-heading compact"><div><h2>This week</h2><p>From discovery to submission.</p></div></div>
                <div className="pipeline-list">
                  {pipeline.map((step) => (
                    <div className="pipeline-row" key={step.label}>
                      <div><span>{step.label}</span><strong>{step.count}</strong></div>
                      <Progress value={step.percent} aria-label={`${step.label}: ${step.count}`} />
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
