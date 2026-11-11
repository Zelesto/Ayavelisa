import {
  ArrowRight,
  ArrowUpRight,
  ClipboardCheck,
  HardHat,
  LockKeyhole,
  Plus,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { SectionEyebrow, StatusPill, useToast } from "@/components/ui";

export default function Configuration() {
  const { resetDemo } = useStore();
  const { notify } = useToast();

  return (
    <>
      <div className="page-heading">
        <div>
          <SectionEyebrow>Governance / Configuration</SectionEyebrow>
          <h1>Rules you can see and version</h1>
          <p>Programme rules, checklists and roles stay configurable without hiding policy decisions in code.</p>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="button button-quiet"
            onClick={() => {
              resetDemo();
              notify("Demo state restored to seed data");
            }}
          >
            Reset demo state
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => notify("Configuration wizard opens in Phase 1")}
          >
            <Plus size={17} />
            New configuration
          </button>
        </div>
      </div>

      <div className="config-grid">
        <section className="panel config-card">
          <div className="config-card-icon">
            <ClipboardCheck size={18} />
          </div>
          <SectionEyebrow>Active checklist</SectionEyebrow>
          <h2>Individual subsidy · v2.3</h2>
          <p>Effective 01 Oct 2026 · Owner: Ayavelisa programme lead</p>
          <div className="config-details">
            <span>9 requirements</span>
            <span>3 evidence types</span>
            <StatusPill label="Approved" tone="success" />
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => notify("Checklist v2.3 · 9 requirements")}
          >
            View checklist version <ArrowRight size={13} />
          </button>
        </section>

        <section className="panel config-card">
          <div className="config-card-icon">
            <ShieldCheck size={18} />
          </div>
          <SectionEyebrow>Status vocabulary</SectionEyebrow>
          <h2>Separate decisions</h2>
          <p>
            Field verification, screening, official outcome, readiness, NHBRC, construction and handover remain
            independent.
          </p>
          <div className="status-stack">
            <StatusPill label="Internally verified" tone="success" />
            <StatusPill label="Officially pending" tone="warning" />
            <StatusPill label="Readiness blocked" tone="danger" />
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => notify("Status vocabulary v1 · 7 dimensions")}
          >
            Review status definitions <ArrowRight size={13} />
          </button>
        </section>

        <section className="panel config-card">
          <div className="config-card-icon">
            <LockKeyhole size={18} />
          </div>
          <SectionEyebrow>Access model</SectionEyebrow>
          <h2>Role &amp; scope controls</h2>
          <p>Project, geography, role and document category are applied to search, exports and downloads.</p>
          <div className="access-rows">
            <span>
              <UserRound size={14} />
              Fieldworker <strong>Assigned visits</strong>
            </span>
            <span>
              <HardHat size={14} />
              Contractor <strong>Assigned units</strong>
            </span>
            <span>
              <ShieldCheck size={14} />
              Auditor <strong>Read only</strong>
            </span>
          </div>
          <button type="button" className="text-button" onClick={() => notify("Role matrix v1 · 8 roles")}>
            Open role matrix <ArrowRight size={13} />
          </button>
        </section>
      </div>

      <section className="panel decision-register">
        <div className="panel-header">
          <div>
            <SectionEyebrow>Discovery decisions</SectionEyebrow>
            <h2>Open questions before production</h2>
          </div>
          <StatusPill label="4 due this phase" tone="warning" />
        </div>

        {[
          {
            id: "D-014",
            title: "Confirm exact NHBRC project and home checklist",
            owner: "NHBRC liaison · due 22 Nov 2026",
            tone: "warning" as const,
          },
          {
            id: "D-017",
            title: "Confirm programme-specific eligibility rules",
            owner: "Programme owner · due 25 Nov 2026",
            tone: "warning" as const,
          },
          {
            id: "D-021",
            title: "Approve POPIA purpose, retention and hosting basis",
            owner: "Information Officer · due 29 Nov 2026",
            tone: "danger" as const,
          },
        ].map((d) => (
          <div className="decision-row" key={d.id}>
            <span className="decision-id">{d.id}</span>
            <div>
              <strong>{d.title}</strong>
              <span>{d.owner}</span>
            </div>
            <StatusPill label="Open" tone={d.tone} />
            <button
              className="icon-button small"
              type="button"
              onClick={() => notify(`${d.id} is open in the discovery register`)}
            >
              <ArrowUpRight size={15} />
            </button>
          </div>
        ))}
      </section>
    </>
  );
}