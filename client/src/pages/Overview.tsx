import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  CloudOff,
  MapPin,
  MoreHorizontal,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { navigate } from "@/lib/router";
import { useStore } from "@/lib/store";
import {
  ActivityItem,
  MetricCard,
  SectionEyebrow,
  StatusPill,
  useToast,
} from "@/components/ui";

const lifecycle = [
  { label: "Intake", count: "1,248", detail: "all active households", tone: "ink" },
  { label: "Verification", count: "978", detail: "78% internally verified", tone: "sage" },
  { label: "Subsidy", count: "614", detail: "external decision pending", tone: "sand" },
  { label: "Readiness", count: "321", detail: "gates satisfied", tone: "blue" },
  { label: "Build", count: "168", detail: "accepted completed homes", tone: "coral" },
];

function fmtTime(iso: string | null) {
  if (!iso) return "08:41";
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

export default function Overview({ onNewIntake }: { onNewIntake: () => void }) {
  const { cases, blockers, activities, sync, isSyncing, runSync } = useStore();
  const { notify } = useToast();

  const queue = useMemo(
    () =>
      cases
        .map((c) => ({ c, open: (blockers[c.id] ?? []).filter((b) => b.status !== "resolved") }))
        .filter((x) => x.open.length > 0 || x.c.nextAction !== "Confirm builder pack")
        .slice(0, 3),
    [cases, blockers],
  );

  const handleSync = async () => {
    try {
      await runSync();
      notify("Sync simulation complete · evidence acknowledged");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Sync failed", "error");
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <SectionEyebrow>Portfolio / Overview</SectionEyebrow>
          <h1>Delivery control room</h1>
          <p>Know what is verified, waiting on an external decision, or blocked before work starts.</p>
        </div>
        <div className="heading-actions">
          <button className="button button-quiet" type="button" onClick={handleSync} disabled={isSyncing}>
            <RefreshCw size={16} />
            {isSyncing ? "Syncing…" : "Sync now"}
          </button>
          <button className="button button-primary" type="button" onClick={onNewIntake}>
            <Plus size={17} />
            New intake
          </button>
        </div>
      </div>

      <div className="notice-banner">
        <div className="notice-symbol">
          <Sparkles size={16} />
        </div>
        <div>
          <strong>Prototype workspace · synthetic data only</strong>
          <span>External departmental and NHBRC decisions are recorded as evidence, never invented by this app.</span>
        </div>
        <button type="button" className="notice-link" onClick={() => navigate("/configuration")}>
          Read operating principles <ArrowRight size={14} />
        </button>
      </div>

      <div className="metric-grid">
        <MetricCard label="Active households" value="1,248" trend="+14" detail="this month" tone="ink" icon={Users} />
        <MetricCard label="Applications in flight" value="386" trend="72" detail="need an action" tone="sand" icon={ClipboardList} />
        <MetricCard label="Homes completed" value="168" trend="+9" detail="accepted this quarter" tone="sage" icon={CheckCircle2} />
        <MetricCard label="Exceptions to review" value="23" detail="8 are overdue" tone="coral" icon={AlertTriangle} />
      </div>

      <div className="content-grid content-grid-main">
        <section className="panel feature-project">
          <div className="panel-header">
            <div>
              <SectionEyebrow>Selected project</SectionEyebrow>
              <h2>Ndlovu Extension Phase 2</h2>
            </div>
            <button className="icon-button" type="button" aria-label="More project actions">
              <MoreHorizontal size={18} />
            </button>
          </div>
          <div className="project-meta">
            <span>
              <MapPin size={14} />
              Ward 14 · Mthatha, Eastern Cape
            </span>
            <span>
              <BriefcaseBusiness size={14} />
              Target 420 homes
            </span>
            <StatusPill label="Active delivery" tone="success" />
          </div>
          <div className="project-progress-row">
            <div>
              <span className="progress-kicker">Accepted completion</span>
              <strong>56%</strong>
            </div>
            <div className="progress-track">
              <div className="progress-fill progress-coral" style={{ width: "56%" }} />
            </div>
            <span className="progress-caption">168 of 300 planned units accepted</span>
          </div>
          <div className="project-stats">
            <div>
              <span>Beneficiary cases</span>
              <strong>286</strong>
              <small>+6 this week</small>
            </div>
            <div>
              <span>Subsidy approved</span>
              <strong>112</strong>
              <small>39% of project</small>
            </div>
            <div>
              <span>Ready for works</span>
              <strong>84</strong>
              <small>18 gates outstanding</small>
            </div>
          </div>
          <div className="project-footer">
            <span>
              <ShieldCheck size={15} />
              Last project review · 11 Nov 2026
            </span>
            <button className="text-button" type="button" onClick={() => navigate("/cases/AY-2026-0118")}>
              Open demo case <ArrowUpRight size={14} />
            </button>
          </div>
        </section>

        <section className="panel action-panel">
          <div className="panel-header">
            <div>
              <SectionEyebrow>Action queue</SectionEyebrow>
              <h2>Needs a decision</h2>
            </div>
            <span className="queue-count">{queue.length} due</span>
          </div>
          {queue.length === 0 && (
            <div className="queue-item">
              <div className="queue-marker marker-sand" />
              <div>
                <strong>No open actions</strong>
                <span>Every sample case has a closed gate</span>
              </div>
              <time>—</time>
            </div>
          )}
          {queue.map(({ c }) => (
            <div className="queue-item" key={c.id}>
              <div
                className={
                  /Blocked|Exception/.test(c.readiness) ? "queue-marker marker-coral" : "queue-marker marker-sand"
                }
              />
              <div>
                <strong>{c.nextAction}</strong>
                <span>
                  {c.id} · {c.name}
                </span>
              </div>
              <time>{c.updated}</time>
            </div>
          ))}
          <button
            type="button"
            className="panel-link"
            onClick={() => navigate("/cases?filter=Needs%20action")}
          >
            View all exceptions <ArrowRight size={14} />
          </button>
        </section>
      </div>

      <section className="panel lifecycle-panel">
        <div className="panel-header lifecycle-header">
          <div>
            <SectionEyebrow>Portfolio pipeline</SectionEyebrow>
            <h2>One record, separate decisions</h2>
          </div>
          <div className="legend">
            <span>
              <i className="legend-dot legend-sage" />
              verified / accepted
            </span>
            <span>
              <i className="legend-dot legend-sand" />
              external decision pending
            </span>
            <span>
              <i className="legend-dot legend-coral" />
              attention
            </span>
          </div>
        </div>
        <div className="lifecycle-row">
          {lifecycle.map((stage, index) => (
            <div className="lifecycle-stage" key={stage.label}>
              <div className={`lifecycle-circle circle-${stage.tone}`}>
                <span>{stage.count}</span>
              </div>
              <div className="lifecycle-stage-copy">
                <strong>{stage.label}</strong>
                <span>{stage.detail}</span>
              </div>
              {index < lifecycle.length - 1 && <ArrowRight className="lifecycle-arrow" size={16} />}
            </div>
          ))}
        </div>
      </section>

      <div className="content-grid content-grid-bottom">
        <section className="panel activity-panel">
          <div className="panel-header">
            <div>
              <SectionEyebrow>Traceable activity</SectionEyebrow>
              <h2>Recent movement</h2>
            </div>
            <button type="button" className="icon-button" aria-label="More activity actions">
              <MoreHorizontal size={18} />
            </button>
          </div>
          <div className="activity-list">
            {activities.slice(0, 5).map((item) => (
              <ActivityItem key={item.id} item={item} />
            ))}
          </div>
        </section>

        <section className="panel offline-panel">
          <div className="offline-top">
            <div className="offline-icon">
              <CloudOff size={20} />
            </div>
            <div>
              <SectionEyebrow>Field operations</SectionEyebrow>
              <h2>Offline queue is healthy</h2>
            </div>
            <StatusPill
              label={sync.pendingUploads === 0 ? "Synced" : "Ready to sync"}
              tone="success"
            />
          </div>
          <div className="offline-stats">
            <div>
              <strong>12</strong>
              <span>assigned visits</span>
            </div>
            <div>
              <strong>{sync.pendingUploads}</strong>
              <span>pending uploads</span>
            </div>
            <div>
              <strong>{fmtTime(sync.lastSync)}</strong>
              <span>last sync</span>
            </div>
          </div>
          <p>Field teams can see assigned records and keep capture separate from the official review.</p>
          <button
            type="button"
            className="button button-outline full-width"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw size={15} />
            {sync.pendingUploads > 0 ? "Run sync simulation" : "Run sync again"}
          </button>
        </section>
      </div>
    </>
  );
}