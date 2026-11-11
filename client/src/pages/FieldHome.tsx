import { ArrowRight, CloudOff, MapPin, RefreshCw, UserCheck, Wifi } from "lucide-react";
import { navigate } from "@/lib/router";
import { useStore } from "@/lib/store";
import { SectionEyebrow, StatusPill, cx, useToast } from "@/components/ui";

function toneFor(status: string) {
  if (status === "approved") return "success" as const;
  if (status === "captured") return "info" as const;
  if (status === "returned") return "danger" as const;
  if (status === "in_progress") return "warning" as const;
  return "neutral" as const;
}

export default function FieldHome() {
  const { visits, cases, sync, currentUser, isOnline, isSyncing, runSync } = useStore();
  const { notify } = useToast();

  const today = new Date().toDateString();
  const mine = visits.filter((v) => new Date(v.scheduledFor).toDateString() === today);
  const assigned = mine.filter((v) => v.status === "assigned").length;
  const inProgress = mine.filter((v) => v.status === "in_progress").length;
  const captured = mine.filter((v) => v.status === "captured").length;
  const returned = mine.filter((v) => v.status === "returned").length;
  const approved = mine.filter((v) => v.status === "approved").length;

  const nextUp = mine.find((v) => v.status === "returned" || v.status === "in_progress" || v.status === "assigned");

  const handleSync = async () => {
    try {
      await runSync();
      notify("Sync complete");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Sync failed", "error");
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <SectionEyebrow>Field / Today</SectionEyebrow>
          <h1>Good morning, {currentUser.name.split(" ")[0]}</h1>
          <p>{assigned + inProgress + returned} visits still to complete · {captured} submitted · {approved} approved.</p>
        </div>
        <div className="heading-actions">
          <button type="button" className="button button-quiet" onClick={handleSync} disabled={isSyncing || !isOnline}>
            <RefreshCw size={16} /> {isSyncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      </div>

      <div className={cx("field-status-banner", !isOnline && "is-offline")}>
        <div className="field-status-icon">{isOnline ? <Wifi size={18} /> : <CloudOff size={18} />}</div>
        <div>
          <strong>{isOnline ? "Online — captures sync immediately" : "Offline — captures queue on this device"}</strong>
          <span>{sync.pendingUploads} pending upload{sync.pendingUploads === 1 ? "" : "s"} · last sync {sync.lastSync ? new Date(sync.lastSync).toLocaleTimeString() : "never"}</span>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card metric-ink"><div className="metric-topline"><span className="metric-label">Assigned</span></div><div className="metric-value">{assigned}</div><div className="metric-detail">not started</div></div>
        <div className="metric-card metric-sand"><div className="metric-topline"><span className="metric-label">In progress</span></div><div className="metric-value">{inProgress}</div><div className="metric-detail">started</div></div>
        <div className="metric-card metric-coral"><div className="metric-topline"><span className="metric-label">Returned</span></div><div className="metric-value">{returned}</div><div className="metric-detail">needs rework</div></div>
        <div className="metric-card metric-sage"><div className="metric-topline"><span className="metric-label">Approved</span></div><div className="metric-value">{approved}</div><div className="metric-detail">this shift</div></div>
      </div>

      {nextUp && (
        <section className="panel" style={{ padding: 21, marginBottom: 14 }}>
          <div className="panel-header">
            <div>
              <SectionEyebrow>Next up</SectionEyebrow>
              <h2>{cases.find((c) => c.id === nextUp.caseId)?.name ?? nextUp.caseId}</h2>
            </div>
            <StatusPill label={nextUp.status.replace("_", " ")} tone={toneFor(nextUp.status)} />
          </div>
          <div className="project-meta" style={{ borderTop: 0 }}>
            <span><MapPin size={14} />{cases.find((c) => c.id === nextUp.caseId)?.location ?? "Unknown"}</span>
            <span><UserCheck size={14} />Visit {nextUp.id}</span>
            <span>Scheduled {new Date(nextUp.scheduledFor).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            <button className="button button-primary" type="button" onClick={() => navigate(`/field/visits/${nextUp.id}`)}>
              {nextUp.status === "assigned" ? "Start visit" : "Resume visit"} <ArrowRight size={14} />
            </button>
            <button className="button button-quiet" type="button" onClick={() => navigate("/field/visits")}>
              See all {mine.length}
            </button>
          </div>
        </section>
      )}

      <section className="panel" style={{ padding: 21 }}>
        <div className="panel-header">
          <div><SectionEyebrow>Today's schedule</SectionEyebrow><h2>{mine.length} visits</h2></div>
          <button type="button" className="text-button" onClick={() => navigate("/field/visits")}>Full list <ArrowRight size={13} /></button>
        </div>
        <div className="visit-list">
          {mine.slice(0, 5).map((v) => {
            const c = cases.find((x) => x.id === v.caseId);
            return (
              <button key={v.id} className="visit-row" type="button" onClick={() => navigate(`/field/visits/${v.id}`)}>
                <div className="visit-time">{new Date(v.scheduledFor).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</div>
                <div className="visit-main">
                  <strong>{c?.name ?? v.caseId}</strong>
                  <span>{c?.location} · {v.id}</span>
                </div>
                <StatusPill label={v.status.replace("_", " ")} tone={toneFor(v.status)} />
                <ArrowRight size={15} style={{ color: "var(--muted)" }} />
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}