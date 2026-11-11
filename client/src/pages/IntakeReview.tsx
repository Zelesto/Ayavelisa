import { useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, MapPin, User, XCircle } from "lucide-react";
import { navigate } from "@/lib/router";
import { useStore } from "@/lib/store";
import { SectionEyebrow, StatusPill, useToast } from "@/components/ui";

export default function IntakeReview() {
  const { intakes, approveIntake, returnIntake } = useStore();
  const { notify } = useToast();
  const [returning, setReturning] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const submitted = intakes.filter((i) => i.status === "submitted" || i.status === "returned");
  const approved = intakes.filter((i) => i.status === "approved");
  const linked = intakes.filter((i) => i.status === "linked_to_existing");

  const doApprove = (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      const created = approveIntake(id);
      notify(
        created ? `Intake approved → new case ${created.id} created` : "Approval failed",
        created ? "success" : "error",
      );
      if (created) navigate(`/cases/${created.id}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Approval failed", "error");
    } finally {
      setBusy(null);
    }
  };

  const doReturn = (id: string) => {
    if (reason.trim().length < 5) {
      notify("Enter a return reason", "error");
      return;
    }
    try {
      returnIntake(id, reason);
      notify("Intake returned to fieldworker");
      setReturning(null);
      setReason("");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Return failed", "error");
    }
  };

  const toggleReturn = (id: string) => {
    if (returning !== id) setReason("");
    setReturning(returning === id ? null : id);
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <SectionEyebrow>Supervisor / Intake review</SectionEyebrow>
          <h1>Intake review queue</h1>
          <p>
            Intakes submitted by fieldworkers. Approve to create the case and auto-schedule a verification visit;
            return for corrections.
          </p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card metric-sand">
          <div className="metric-topline"><span className="metric-label">Awaiting review</span></div>
          <div className="metric-value">{submitted.filter((i) => i.status === "submitted").length}</div>
          <div className="metric-detail">submitted</div>
        </div>
        <div className="metric-card metric-coral">
          <div className="metric-topline"><span className="metric-label">Returned</span></div>
          <div className="metric-value">{submitted.filter((i) => i.status === "returned").length}</div>
          <div className="metric-detail">with fieldworker</div>
        </div>
        <div className="metric-card metric-sage">
          <div className="metric-topline"><span className="metric-label">Approved</span></div>
          <div className="metric-value">{approved.length}</div>
          <div className="metric-detail">cases created</div>
        </div>
        <div className="metric-card metric-ink">
          <div className="metric-topline"><span className="metric-label">Linked</span></div>
          <div className="metric-value">{linked.length}</div>
          <div className="metric-detail">to existing cases</div>
        </div>
      </div>

      <section className="panel cases-panel">
        <div className="table-toolbar"><SectionEyebrow>Submitted intakes</SectionEyebrow></div>
        <div className="visit-list">
          {submitted.map((i) => {
            const memberCount = (i.householdMembers ?? []).filter((m) => m.fullName?.trim()).length;
            const submittedLabel = i.submittedAt ? new Date(i.submittedAt).toLocaleString() : "—";
            const village = i.location?.village ?? "";
            const ward = i.location?.ward ?? "";
            const sourcesLabel =
              (i.programmes ?? []).map((p) => p.listName).join(", ") || "no sources";
            const isReturning = returning === i.id;
            return (
              <div
                key={i.id}
                className="intake-review-card"
                style={{ padding: 16, borderBottom: "1px solid var(--line-light)" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <strong style={{ fontSize: 13 }}>
                        {i.applicantFirstName} {i.applicantSurname}
                      </strong>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 10,
                          color: "var(--coral-dark)",
                          background: "var(--coral-light)",
                          padding: "2px 6px",
                          borderRadius: 3,
                        }}
                      >
                        {i.id}
                      </span>
                      <StatusPill
                        label={i.status}
                        tone={i.status === "returned" ? "danger" : "warning"}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted-dark)", marginTop: 4 }}>
                      <MapPin size={11} style={{ verticalAlign: "-1px" }} />{" "}
                      {village}{ward ? `, ${ward}` : ""} · {memberCount} members · {sourcesLabel}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                      Captured by {i.capturedBy} · {i.capturedFromName || i.capturedFrom} · submitted {submittedLabel}
                    </div>
                    {i.status === "returned" && i.returnReason && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 8,
                          background: "var(--danger-light)",
                          borderRadius: 5,
                          fontSize: 10,
                          color: "var(--danger)",
                        }}
                      >
                        <AlertTriangle size={11} style={{ verticalAlign: "-1px" }} /> Previously returned:{" "}
                        {i.returnReason}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    <button
                      className="button button-quiet"
                      style={{ fontSize: 11 }}
                      type="button"
                      onClick={() => navigate(`/intake/${i.id}`)}
                    >
                      View / edit
                    </button>
                    <button
                      className="button button-primary"
                      style={{ fontSize: 11 }}
                      type="button"
                      onClick={() => doApprove(i.id)}
                      disabled={!!busy}
                    >
                      <CheckCircle2 size={13} /> {busy === i.id ? "Approving…" : "Approve"}
                    </button>
                    <button
                      className="button button-quiet"
                      style={{ fontSize: 11 }}
                      type="button"
                      onClick={() => toggleReturn(i.id)}
                      aria-expanded={isReturning}
                      disabled={!!busy}
                    >
                      <XCircle size={13} /> Return
                    </button>
                  </div>
                </div>
                {isReturning && (
                  <div style={{ marginTop: 12, padding: 12, background: "var(--paper)", borderRadius: 6 }}>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason for return (visible to fieldworker)"
                      aria-label="Reason for return"
                      style={{
                        width: "100%",
                        padding: 8,
                        fontSize: 11,
                        border: "1px solid var(--line)",
                        borderRadius: 5,
                        minHeight: 60,
                      }}
                    />
                    <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        className="button button-quiet"
                        type="button"
                        onClick={() => {
                          setReturning(null);
                          setReason("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="button button-primary"
                        type="button"
                        onClick={() => doReturn(i.id)}
                      >
                        Confirm return
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {submitted.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
              <User size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div style={{ fontSize: 12 }}>No intakes awaiting review.</div>
              <div style={{ fontSize: 10, marginTop: 4 }}>
                When a fieldworker submits an intake, it appears here.
              </div>
            </div>
          )}
        </div>
      </section>

      {approved.length > 0 && (
        <section className="panel cases-panel" style={{ marginTop: 14 }}>
          <div className="table-toolbar"><SectionEyebrow>Approved</SectionEyebrow></div>
          <div className="visit-list">
            {approved.map((i) => (
              <button
                key={i.id}
                className="visit-row"
                type="button"
                onClick={() => i.createdCaseId && navigate(`/cases/${i.createdCaseId}`)}
              >
                <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--sage)" }}>{i.id}</span>
                <div className="visit-main">
                  <strong>
                    {i.applicantFirstName} {i.applicantSurname}
                  </strong>
                  <span>→ {i.createdCaseId}</span>
                </div>
                <StatusPill label="approved" tone="success" />
                <ArrowRight size={14} style={{ color: "var(--muted)" }} />
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}