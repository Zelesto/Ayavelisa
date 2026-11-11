import { CheckCircle2, MapPin, RefreshCw } from "lucide-react";
import { navigate } from "@/lib/router";
import { useStore } from "@/lib/store";
import { SectionEyebrow, StatusPill, useToast } from "@/components/ui";

export default function ReviewQueue() {
  const { visits, cases, isSyncing, runSync, runVerifyNowChecks } = useStore();
  const { notify } = useToast();
  const pending = visits.filter((v) => v.status === "captured");
  const returned = visits.filter((v) => v.status === "returned");
  const approved = visits.filter((v) => v.status === "approved");

  const handleRefresh = async () => {
    try {
      await runSync();
      notify("Sync refreshed");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Refresh failed", "error");
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <SectionEyebrow>Supervisor / Review</SectionEyebrow>
          <h1>Review queue</h1>
          <p>Submitted visits waiting on your decision. Approve or return with a reason.</p>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="button button-quiet"
            onClick={handleRefresh}
            disabled={isSyncing}
          >
            <RefreshCw size={15} /> {isSyncing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card metric-sand">
          <div className="metric-topline"><span className="metric-label">Awaiting review</span></div>
          <div className="metric-value">{pending.length}</div>
          <div className="metric-detail">captured</div>
        </div>
        <div className="metric-card metric-coral">
          <div className="metric-topline"><span className="metric-label">Returned</span></div>
          <div className="metric-value">{returned.length}</div>
          <div className="metric-detail">with fieldworker</div>
        </div>
        <div className="metric-card metric-sage">
          <div className="metric-topline"><span className="metric-label">Approved</span></div>
          <div className="metric-value">{approved.length}</div>
          <div className="metric-detail">closed</div>
        </div>
      </div>

      <section className="panel cases-panel">
        <div className="table-toolbar"><SectionEyebrow>Awaiting review</SectionEyebrow></div>
        <div className="visit-list">
          {pending.map((v) => {
            const c = cases.find((x) => x.id === v.caseId);
            const submittedDate = new Date(v.submittedAt ?? v.scheduledFor).toLocaleDateString("en-ZA", {
              day: "2-digit",
              month: "short",
            });
            const latestCheck = c?.verifyNowChecks?.at(-1);
            return (
              <div
                key={v.id}
                className="visit-row visit-row-large review-visit-row"
              >
                <div className="visit-time">{submittedDate}</div>
                <div className="visit-main">
                  <strong>{c?.name ?? v.caseId}</strong>
                  <span>
                    <MapPin size={11} style={{ verticalAlign: "-1px" }} /> {c?.location ?? "Unknown"} · {v.id} ·
                    submitted by {v.assignedTo}
                  </span>
                </div>
                <StatusPill label="captured" tone="info" />
                {latestCheck && <span className="verify-result-tag">{latestCheck.status === "not_configured" ? "VerifyNow not configured" : latestCheck.outcome}</span>}
                <button className="button button-outline" type="button" onClick={() => navigate(`/field/visits/${v.id}`)}>Review</button>
                <button
                  className="button button-quiet"
                  type="button"
                  onClick={() => {
                    runVerifyNowChecks([v.caseId]);
                    notify("VerifyNow request saved to the case. API not configured; no external check was performed.", "error");
                  }}
                >
                  Run VerifyNow
                </button>
              </div>
            );
          })}
          {pending.length === 0 && (
            <div style={{ padding: 24, color: "var(--muted)", textAlign: "center" }}>
              No visits awaiting review.
            </div>
          )}
        </div>
      </section>

      {returned.length > 0 && (
        <section className="panel cases-panel" style={{ marginTop: 14 }}>
          <div className="table-toolbar"><SectionEyebrow>Returned</SectionEyebrow></div>
          <div className="visit-list">
            {returned.map((v) => (
              <div
                key={v.id}
                className="visit-row visit-row-large"
                style={{ cursor: "default" }}
              >
                <div className="visit-time">
                  <CheckCircle2 size={16} style={{ color: "var(--danger)" }} />
                </div>
                <div className="visit-main">
                  <strong>{cases.find((x) => x.id === v.caseId)?.name ?? v.caseId}</strong>
                  <span>{v.returnReason ?? "No reason recorded"}</span>
                </div>
                <StatusPill label="returned" tone="danger" />
                <span aria-hidden="true" />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}