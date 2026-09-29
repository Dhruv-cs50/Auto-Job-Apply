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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const applications = [
  {
    company: "Aurora Mobility",
    role: "Data Scientist, Forecasting",
    location: "San Francisco, CA",
    source: "Jobright",
    posted: "2h ago",
    fresh: true,
    score: 94,
    status: "Ready to review",
    tone: "review",
    next: "Review answers",
  },
  {
    company: "Northstar Transit",
    role: "Machine Learning Engineer",
    location: "Remote · US",
    source: "LinkedIn alert",
    posted: "5h ago",
    fresh: true,
    score: 89,
    status: "Approved",
    tone: "approved",
    next: "Queued for 10:30 AM",
  },
  {
    company: "Cityflow Labs",
    role: "Applied Scientist",
    location: "Seattle, WA",
    source: "Company site",
    posted: "19h ago",
    fresh: true,
    score: 86,
    status: "Submitted",
    tone: "submitted",
    next: "Track response",
  },
  {
    company: "Civic Route",
    role: "Analytics Engineer",
    location: "Oakland, CA",
    source: "Jobright",
    posted: "1d ago",
    fresh: false,
    score: 78,
    status: "Needs answer",
    tone: "blocked",
    next: "Work authorization",
  },
  {
    company: "Vector Grid",
    role: "Operations Research Analyst",
    location: "San Jose, CA",
    source: "LinkedIn alert",
    posted: "2d ago",
    fresh: false,
    score: 74,
    status: "Discovered",
    tone: "discovered",
    next: "Review fit summary",
  },
];

const stats = [
  { label: "Fresh in last 24h", value: "12", note: "Pinned first", icon: Clock3 },
  { label: "Strong matches", value: "18", note: "+6 today", icon: Sparkles },
  { label: "Awaiting review", value: "7", note: "3 high priority", icon: CalendarClock },
  { label: "Submitted", value: "24", note: "8 this week", icon: FileCheck2 },
];

const pipeline = [
  { label: "Discovered", count: 48, percent: 100 },
  { label: "Strong fit", count: 18, percent: 38 },
  { label: "Approved", count: 9, percent: 19 },
  { label: "Submitted", count: 6, percent: 13 },
];

function StatusBadge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <Badge className={`status-badge status-${tone}`}>{children}</Badge>;
}

export default function Home() {
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
              <BriefcaseBusiness /> Applications <span className="nav-count">7</span>
            </a>
            <a className="nav-item" href="#schedule"><CalendarClock /> Schedule</a>
            <a className="nav-item" href="#profile"><FileCheck2 /> Candidate profile</a>
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
              <p className="eyebrow">Tuesday, September 29</p>
              <h1>Your application pipeline</h1>
              <p className="heading-copy">
                Jobright and LinkedIn alerts found 6 new strong matches. Fresh roles are ranked first.
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
                      <TableRow key={`${application.company}-${application.role}`}>
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
                  </TableBody>
                </Table>
              </div>
            </section>

            <aside className="right-column">
              <section className="panel attention-panel">
                <div className="panel-heading compact">
                  <div><h2>Needs attention</h2><p>3 items are holding the queue.</p></div>
                  <span className="attention-icon"><AlertTriangle size={17} /></span>
                </div>
                <div className="attention-list">
                  <button type="button"><span><strong>Review top match</strong><small>Aurora Mobility · 94 fit</small></span><ChevronRight /></button>
                  <button type="button"><span><strong>Answer required question</strong><small>Civic Route · work authorization</small></span><ChevronRight /></button>
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
