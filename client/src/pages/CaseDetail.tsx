import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileDown,
  FileCheck2,
  FileText,
  HardHat,
  Home as HomeIcon,
  Info,
  Landmark,
  MapPin,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { navigate } from "@/lib/router";
import { useStore } from "@/lib/store";
import { MissingState, SectionEyebrow, StatusPill, cx, useToast } from "@/components/ui";
import { exportDepartmentPacket, type ExportFormat } from "@/lib/caseExport";
import type { Blocker, Tone } from "@/lib/types";

function StatusDimension({
  label,
  value,
  note,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  note: string;
  tone: Tone;
  icon: typeof Check;
}) {
  return (
    <div className="dimension-card">
      <div className={cx("dimension-icon", `dimension-${tone}`)}>
        <Icon size={16} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </div>
  );
}

function CheckRow({
  label,
  status,
  source,
  tone = "success",
}: {
  label: string;
  status: string;
  source: string;
  tone?: Tone;
}) {
  return (
    <div className="check-row">
      <div className={cx("check-icon", `check-${tone}`)}>
        {tone === "success" ? <Check size={14} /> : tone === "warning" ? <Clock3 size={14} /> : <AlertTriangle size={14} />}
      </div>
      <div className="check-copy">
        <strong>{label}</strong>
        <span>{source}</span>
      </div>
      <StatusPill label={status} tone={tone} />
    </div>
  );
}

export default function CaseDetail({ caseId }: { caseId: string }) {
  const { cases, visits, blockers, requestBlocker, assignBlocker, resolveBlocker, isSyncing, runSync, runVerifyNowChecks, markDepartmentPacketExported } = useStore();
  const { notify } = useToast();

  const item = cases.find((record) => record.id === caseId);

  if (!item) {
    return (
      <MissingState
        title="Case not found"
        detail={`No controlled record matches ${caseId}.`}
        action={
          <button className="button button-primary" type="button" onClick={() => navigate("/cases")}>
            Back to beneficiary register
          </button>
        }
      />
    );
  }

  const list = blockers[item.id] ?? [];
  const open = list.filter((b) => b.status !== "resolved");
  const readinessTone: Tone = item.readiness.startsWith("Ready")
    ? "success"
    : /Blocked|Exception/.test(item.readiness)
      ? "danger"
      : "neutral";

  const syncNow = async () => {
    try {
      await runSync();
      notify("Evidence sync complete · queue acknowledged");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Evidence sync failed", "error");
    }
  };
  const runVerifyNow = () => {
    runVerifyNowChecks([item.id]);
    notify("VerifyNow request saved to this case. API not configured; no external check was performed.", "error");
  };
  const preparePacket = async (format: ExportFormat) => {
    try {
      await exportDepartmentPacket(item, visits, format);
      markDepartmentPacketExported(item.id);
      notify("Draft department packet exported. It has not been submitted to the department.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not export department packet", "error");
    }
  };

  const act = (blocker: Blocker) => {
    if (blocker.status === "open") {
      if (blocker.primary === "assign") {
        assignBlocker(item.id, blocker.id);
        notify("Gate assigned to the technical lead");
      } else {
        requestBlocker(item.id, blocker.id);
        notify("Evidence requested from the fieldworker");
      }
    } else {
      resolveBlocker(item.id, blocker.id);
      notify("Gate closed · readiness recalculated");
    }
  };

  return (
    <>
      <button className="back-link" type="button" onClick={() => navigate("/cases")}>
        <ArrowLeft size={15} />
        Back to beneficiary register
      </button>

      <div className="case-heading">
        <div>
          <SectionEyebrow>Case file / {item.id}</SectionEyebrow>
          <h1>{item.name}</h1>
          <p>
            {item.household} · {item.project} · <span className="synthetic-inline">Synthetic record</span>
          </p>
        </div>
        <div className="heading-actions">
          <button type="button" className="button button-outline" onClick={runVerifyNow}>
            <ShieldCheck size={16} /> Run VerifyNow
          </button>
          <div className="case-packet-actions">
            <button type="button" className="button button-quiet" onClick={() => void preparePacket("pdf")}><FileDown size={15} /> Department packet PDF</button>
            <button type="button" className="button button-quiet" onClick={() => void preparePacket("xlsx")}>Excel</button>
          </div>
          <button type="button" className="button button-primary" onClick={syncNow} disabled={isSyncing}>
            <RefreshCw size={16} />
            {isSyncing ? "Syncing…" : "Sync evidence"}
          </button>
        </div>
      </div>

      <div className="case-summary-strip">
        <div>
          <span>Primary applicant</span>
          <strong>{item.name}</strong>
          <small>Person record · internal ID P-002941</small>
        </div>

        {item.verifyNowChecks?.length ? (
          <section className="panel verify-result-panel">
            <div className="panel-header">
              <div><SectionEyebrow>Identity check history</SectionEyebrow><h2>VerifyNow</h2></div>
              <StatusPill label={item.verifyNowChecks.at(-1)?.status === "not_configured" ? "Not configured" : item.verifyNowChecks.at(-1)?.outcome ?? "Not run"} tone={item.verifyNowChecks.at(-1)?.status === "completed" ? "success" : "warning"} />
            </div>
            <p>{item.verifyNowChecks.at(-1)?.summary}</p>
            <small>Requested by {item.verifyNowChecks.at(-1)?.checkedBy} · {new Date(item.verifyNowChecks.at(-1)?.checkedAt ?? "").toLocaleString()}</small>
          </section>
        ) : null}
        {item.departmentPacketExportedAt && <div className="capture-note">Draft packet exported {new Date(item.departmentPacketExportedAt).toLocaleString()} · not sent to the department.</div>}
        <div>
          <span>Household</span>
          <strong>{item.members} members</strong>
          <small>Last confirmed 10 Nov 2026</small>
        </div>
        <div>
          <span>Project participation</span>
          <strong>Active</strong>
          <small>Source: {item.source}</small>
        </div>
        <div>
          <span>Current owner</span>
          <strong>Thandi Ndlovu</strong>
          <small>Verification supervisor</small>
        </div>
      </div>

      <section className="status-rail">
        <div className="status-rail-header">
          <div>
            <SectionEyebrow>Independent status dimensions</SectionEyebrow>
            <h2>Where the case stands</h2>
          </div>
          <span className="as-at">
            <CalendarDays size={14} />
            As at 11 Nov 2026 · 10:10 SAST
          </span>
        </div>
        <div className="dimension-grid">
          <StatusDimension
            label="Field verification"
            value={item.verification}
            note="10 Nov · T. Ndlovu"
            tone={item.verificationTone}
            icon={ShieldCheck}
          />
          <StatusDimension label="Screening" value="Advisory pass" note="Checklist v2.3" tone="info" icon={ClipboardCheck} />
          <StatusDimension
            label="Official subsidy"
            value={item.subsidy}
            note="Not a departmental decision"
            tone={item.subsidyTone}
            icon={Landmark}
          />
          <StatusDimension
            label="Site readiness"
            value={item.readiness}
            note={open.length ? `${open.length} mandatory gate${open.length > 1 ? "s" : ""}` : "All gates satisfied"}
            tone={readinessTone}
            icon={AlertTriangle}
          />
          <StatusDimension label="NHBRC home" value="Not confirmed" note="Project file linked" tone="neutral" icon={FileCheck2} />
          <StatusDimension label="Construction" value="Not started" note="No authorisation" tone="neutral" icon={HardHat} />
          <StatusDimension label="Handover" value="Not started" note="Closeout gate" tone="neutral" icon={ClipboardList} />
        </div>
      </section>

      <div className="case-workbench">
        <div className="case-main-column">
          {open.length > 0 ? (
            <section className="panel blocker-panel">
              <div className="blocker-heading">
                <div className="alert-badge">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <SectionEyebrow>Readiness exception</SectionEyebrow>
                  <h2>Construction is not authorised</h2>
                  <p>Verification is complete, but that does not make this household ready for construction.</p>
                </div>
                <StatusPill label={`${open.length} gate${open.length > 1 ? "s" : ""} open`} tone="danger" />
              </div>
              <div className="blocker-list">
                {list.map((blocker, index) => (
                  <div key={blocker.id}>
                    <span className="blocker-number">{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{blocker.label}</strong>
                      <span>
                        {blocker.detail}
                        {blocker.status !== "open" && blocker.status !== "resolved" ? ` · ${blocker.status}` : ""}
                      </span>
                    </div>
                    {blocker.status === "resolved" ? (
                      <span className="resolved-tag">
                        <CheckCircle2 size={13} /> Resolved
                      </span>
                    ) : blocker.status === "open" ? (
                      <button type="button" className="text-button" onClick={() => act(blocker)}>
                        {blocker.primary === "assign" ? "Assign" : "Request"} <ArrowRight size={13} />
                      </button>
                    ) : (
                      <button type="button" className="text-button" onClick={() => act(blocker)}>
                        Mark resolved <Check size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="panel">
              <div className="blocker-heading">
                <div className="alert-badge" style={{ background: "var(--sage-light)", color: "var(--sage)" }}>
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <SectionEyebrow>Readiness</SectionEyebrow>
                  <h2>No readiness exceptions</h2>
                  <p>All recorded gates are satisfied. Construction still requires authorised sign-off.</p>
                </div>
                <StatusPill label="Gates satisfied" tone="success" />
              </div>
            </section>
          )}

          <section className="panel">
            <div className="panel-header">
              <div>
                <SectionEyebrow>Evidence-led verification</SectionEyebrow>
                <h2>Field verification · completed</h2>
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => notify("Visit record is read-only in this demo")}
              >
                View visit record <ArrowUpRight size={13} />
              </button>
            </div>
            <div className="verification-meta">
              <span>
                <MapPin size={14} />
                Captured at 31.5889° S, 28.7844° E
              </span>
              <span>
                <Clock3 size={14} />
                10 Nov 2026 · 14:23
              </span>
              <StatusPill label="Accuracy 8 m" tone="info" />
            </div>
            <div className="check-list">
              <CheckRow label="Identity evidence" status="Evidenced" source="ID scan · captured 10 Nov · Fieldworker" />
              <CheckRow label="Household composition" status="Observed" source="Interview + member declarations · 5 people" />
              <CheckRow
                label="Occupancy and address"
                status="Declared"
                source="Applicant declaration · proof of residence outstanding"
                tone="warning"
              />
              <CheckRow label="Vulnerability needs" status="No needs recorded" source="Applicant declaration · 10 Nov" />
              <CheckRow label="Programme source" status="Confirmed" source="Municipal list row 1842 · imported 02 Nov" />
            </div>
            <div className="evidence-note">
              <Info size={15} />
              <span>
                Observed, declared and externally confirmed information are kept separate so a reviewer can see what
                still needs proof.
              </span>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <SectionEyebrow>Application administration</SectionEyebrow>
                <h2>Subsidy application pack</h2>
              </div>
              <StatusPill label={item.subsidy} tone={item.subsidyTone} />
            </div>
            <div className="subsidy-progress">
              <div>
                <strong>7 of 9 checklist items</strong>
                <span>Pack is not yet ready for official submission</span>
              </div>
              <div className="mini-progress">
                <div style={{ width: "78%" }} />
              </div>
              <span className="percentage">78%</span>
            </div>
            <div className="check-list">
              <CheckRow label="Applicant and household details" status="Complete" source="Verified data · form v2.3" />
              <CheckRow
                label="Identity and residency evidence"
                status="1 missing"
                source="Proof of residence required"
                tone="warning"
              />
              <CheckRow
                label="Prior assistance check"
                status="Unconfirmed"
                source="Awaiting authorised source evidence"
                tone="warning"
              />
              <CheckRow label="Signed acknowledgement" status="Captured" source="isiXhosa witnessed alternative · 10 Nov" />
            </div>
            <div className="subsidy-footer">
              <span>
                <FileText size={15} />
                Draft pack · revision 03 · not frozen
              </span>
              <button
                type="button"
                className="button button-outline"
                onClick={() => notify("Checklist v2.3 · 9 requirements · 2 outstanding")}
              >
                Review checklist <ArrowRight size={14} />
              </button>
            </div>
          </section>
        </div>

        <aside className="case-side-column">
          <section className="panel side-card">
            <div className="panel-header">
              <div>
                <SectionEyebrow>Site &amp; dwelling</SectionEyebrow>
                <h2>{item.site}</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Site actions">
                <MoreHorizontal size={17} />
              </button>
            </div>
            <div className="side-map">
              <MapPin size={20} />
              <span>Provisional plot location</span>
              <small>GPS accuracy 8 m · manual pin unchanged</small>
            </div>
            <div className="side-details">
              <div>
                <span>House type</span>
                <strong>40 m² · Type A</strong>
              </div>
              <div>
                <span>Allocation</span>
                <strong>Active · 08 Nov 2026</strong>
              </div>
              <div>
                <span>Land rights</span>
                <strong
                  className={open.some((b) => /Geotechnical|land/i.test(b.label)) ? "danger-text" : undefined}
                >
                  {open.some((b) => /Geotechnical|land/i.test(b.label)) ? "Evidence missing" : "Recorded"}
                </strong>
              </div>
            </div>
            <button type="button" className="button button-outline full-width" onClick={() => navigate("/sites")}>
              Open site record <ArrowUpRight size={14} />
            </button>
          </section>

          <section className="panel side-card">
            <div className="panel-header">
              <div>
                <SectionEyebrow>NHBRC repository</SectionEyebrow>
                <h2>Separate enrolments</h2>
              </div>
              <StatusPill label="Repository only" tone="neutral" />
            </div>
            <div className="nhbrc-item">
              <div className="mini-file">
                <FileCheck2 size={16} />
              </div>
              <div>
                <strong>Project enrolment</strong>
                <span>Project file linked · ref PRJ-EC-442</span>
              </div>
              <StatusPill label="Received" tone="success" />
            </div>
            <div className="nhbrc-item">
              <div className="mini-file">
                <HomeIcon size={16} />
              </div>
              <div>
                <strong>Home enrolment</strong>
                <span>{item.site} · certificate not confirmed</span>
              </div>
              <StatusPill label="Outstanding" tone="warning" />
            </div>
            <p className="side-note">
              A project certificate does not set this dwelling to enrolled. Official home evidence must be linked per
              plot.
            </p>
          </section>

          <section className="panel side-card">
            <div className="panel-header">
              <div>
                <SectionEyebrow>Controlled evidence</SectionEyebrow>
                <h2>Documents &amp; audit</h2>
              </div>
              <button type="button" className="text-button" onClick={() => notify("Document register opens in Phase 1")}>
                View all <ArrowUpRight size={13} />
              </button>
            </div>
            <div className="document-row">
              <FileText size={16} />
              <div>
                <strong>ID document · original</strong>
                <span>PDF · 2.1 MB · hash recorded</span>
              </div>
              <CheckCircle2 className="doc-ok" size={15} />
            </div>
            <div className="document-row">
              <FileText size={16} />
              <div>
                <strong>Field visit photos · 4</strong>
                <span>JPG · linked to visit and plot</span>
              </div>
              <CheckCircle2 className="doc-ok" size={15} />
            </div>
            <div className="document-row">
              <FileText size={16} />
              <div>
                <strong>Proof of residence</strong>
                <span>Not yet captured · follow-up open</span>
              </div>
              <AlertTriangle className="doc-warn" size={15} />
            </div>
            <div className="audit-line">
              <span className="audit-avatar">TN</span>
              <div>
                <strong>Thandi Ndlovu</strong>
                <span>Verified case · 10 Nov 2026, 16:04</span>
              </div>
              <ArrowUpRight size={14} />
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}