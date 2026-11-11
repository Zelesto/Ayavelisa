import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  FileText,
  Landmark,
  LockKeyhole,
  Users,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { SectionEyebrow, StatusPill, useToast } from "@/components/ui";
import { exportCases } from "@/lib/caseExport";

export default function Reports() {
  const { cases, blockers } = useStore();
  const { notify } = useToast();
  const activeCases = cases.filter((item) => !item.archivedAt);
  const exportReport = async (format: "xlsx" | "pdf" | "csv") => {
    if (!activeCases.length) { notify("There are no active cases to export", "error"); return; }
    try {
      await exportCases(activeCases, format, `ayavelisa-report-${new Date().toISOString().slice(0, 10)}`);
      notify(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not export report", "error");
    }
  };
  const openGates = cases.reduce(
    (n, c) => n + (blockers[c.id] ?? []).filter((b) => b.status !== "resolved").length,
    0,
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <SectionEyebrow>Management information</SectionEyebrow>
          <h1>Reports that keep their meaning</h1>
          <p>Every view is anchored to a project, denominator, as-at date and snapshot.</p>
        </div>
        <div className="heading-actions">
          <button type="button" className="button button-outline" onClick={() => void exportReport("xlsx")}>Excel</button>
          <button type="button" className="button button-outline" onClick={() => void exportReport("pdf")}>PDF</button>
          <button type="button" className="button button-primary" onClick={() => void exportReport("csv")}><FileText size={16} /> CSV report</button>
        </div>
      </div>

      <div className="report-callout">
        <div className="report-callout-icon">
          <BookOpen size={20} />
        </div>
        <div>
          <strong>Metric dictionary active</strong>
          <span>
            "Approved beneficiary" means an evidenced official decision. "Completed home" means the approved
            technical completion gate — not a reported photo or visit.
          </span>
        </div>
        <button type="button" className="text-button" onClick={() => notify("Metric dictionary v1.0 is loaded")}>
          Open dictionary <ArrowRight size={13} />
        </button>
      </div>

      <div className="report-grid">
        <section className="panel report-card">
          <div className="report-card-top">
            <div className="report-icon report-blue">
              <Landmark size={19} />
            </div>
            <StatusPill label="Issued · locked" tone="success" />
          </div>
          <SectionEyebrow>Monthly client progress</SectionEyebrow>
          <h2>October 2026 delivery report</h2>
          <p>Snapshot of progress, subsidy pipeline, financial position, risks and next-period plan.</p>
          <div className="report-meta">
            <span>
              <CalendarDays size={14} />
              Issued 03 Nov 2026
            </span>
            <span>
              <LockKeyhole size={14} />
              Snapshot #2026-10-03
            </span>
          </div>
          <button
            type="button"
            className="button button-outline full-width"
            onClick={() => notify("Issued report is read-only by design")}
          >
            Open issued report <ArrowUpRight size={14} />
          </button>
        </section>

        <section className="panel report-card">
          <div className="report-card-top">
            <div className="report-icon report-coral">
              <AlertTriangle size={19} />
            </div>
            <StatusPill label="Needs review" tone="warning" />
          </div>
          <SectionEyebrow>Readiness exceptions</SectionEyebrow>
          <h2>Sites with open gates</h2>
          <p>Breakdown by ward, gate type, owner and age, with the denominator visible.</p>
          <div className="report-stat">
            <strong>{openGates}</strong>
            <span>gates currently open across the demo dataset</span>
          </div>
          <button
            type="button"
            className="button button-outline full-width"
            onClick={() => notify(`${openGates} gates open in the demo dataset`)}
          >
            Review exceptions <ArrowUpRight size={14} />
          </button>
        </section>

        <section className="panel report-card">
          <div className="report-card-top">
            <div className="report-icon report-sage">
              <Users size={19} />
            </div>
            <StatusPill label="Ready to export" tone="info" />
          </div>
          <SectionEyebrow>Beneficiary reconciliation</SectionEyebrow>
          <h2>November source register</h2>
          <p>Matched, unmatched, duplicates, unresolved identities and imported-row totals.</p>
          <div className="report-stats-inline">
            <div>
              <strong>{cases.length}</strong>
              <span>source rows</span>
            </div>
            <div>
              <strong>{cases.filter((c) => c.verificationTone === "success").length}</strong>
              <span>verified</span>
            </div>
            <div>
              <strong>{cases.filter((c) => c.verificationTone === "danger").length}</strong>
              <span>review</span>
            </div>
          </div>
          <button
            type="button"
            className="button button-outline full-width"
            onClick={() => notify("Reconciliation export uses the register filter")}
          >
            Preview export <ArrowUpRight size={14} />
          </button>
        </section>
      </div>

      <section className="panel issued-panel">
        <div className="panel-header">
          <div>
            <SectionEyebrow>Issued reports</SectionEyebrow>
            <h2>Frozen snapshots and distribution</h2>
          </div>
          <button type="button" className="text-button" onClick={() => notify("Report register opens in Phase 2")}>
            View report register <ArrowRight size={13} />
          </button>
        </div>
        <div className="issued-row">
          <span>October 2026 client progress</span>
          <span>03 Nov 2026</span>
          <StatusPill label="Issued" tone="success" />
          <span>7 recipients</span>
          <button type="button" className="icon-button small" aria-label="Open">
            <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="issued-row">
          <span>September 2026 client progress</span>
          <span>04 Oct 2026</span>
          <StatusPill label="Superseded" tone="neutral" />
          <span>7 recipients</span>
          <button type="button" className="icon-button small" aria-label="Open">
            <ArrowUpRight size={15} />
          </button>
        </div>
      </section>
    </>
  );
}