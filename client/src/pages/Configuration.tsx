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
import { useAuth } from "@/components/AuthGate";
import { navigate } from "@/lib/router";

export default function Configuration() {
  const { resetDemo } = useStore();
  const { user } = useAuth();
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
          <h2>Role-based access</h2>
          <p>Roles control available screens and workspace changes. All authorized demo accounts share the same records.</p>
          <div className="access-rows">
            <span>
              <UserRound size={14} />
              Fieldworker <strong>Field capture</strong>
            </span>
            <span>
              <HardHat size={14} />
              Supervisor <strong>Full workspace</strong>
            </span>
            <span>
              <ShieldCheck size={14} />
              Reviewer <strong>Review &amp; cases</strong>
            </span>
            <span><LockKeyhole size={14} />Administrator <strong>Manage users &amp; roles</strong></span>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => user?.role === "admin" ? navigate("/users") : notify("Only administrators can manage user accounts")}
          >
            {user?.role === "admin" ? "Manage users & roles" : "View role permissions"} <ArrowRight size={13} />
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