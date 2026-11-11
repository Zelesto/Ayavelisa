import { useMemo } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Filter, Map, Plus, Target } from "lucide-react";
import { navigate } from "@/lib/router";
import { useStore } from "@/lib/store";
import { MetricCard, SectionEyebrow, StatusPill, useToast } from "@/components/ui";

export default function Sites() {
  const { cases, blockers } = useStore();
  const { notify } = useToast();

  const rows = useMemo(
    () =>
      cases
        .filter((c) => c.site !== "Unallocated")
        .map((c) => {
          const open = (blockers[c.id] ?? []).filter((b) => b.status !== "resolved");
          return { c, open };
        }),
    [cases, blockers],
  );

  const ready = rows.filter((r) => r.open.length === 0).length;
  const blocked = rows.filter((r) => r.open.length > 0).length;
  const unallocated = cases.filter((c) => c.site === "Unallocated").length;

  return (
    <>
      <div className="page-heading">
        <div>
          <SectionEyebrow>Delivery / Sites</SectionEyebrow>
          <h1>Sites &amp; readiness</h1>
          <p>Readiness is a gate, not a guess. See exactly what keeps work from starting.</p>
        </div>
        <button
          type="button"
          className="button button-primary"
          onClick={() => notify("Site registration opens in Phase 1")}
        >
          <Plus size={17} />
          Add site
        </button>
      </div>

      <div className="metric-grid compact-metrics">
        <MetricCard label="Sites in register" value={String(rows.length)} detail="demo sample" tone="ink" icon={Map} />
        <MetricCard label="Ready for works" value={String(ready)} detail="all mandatory gates met" tone="sage" icon={CheckCircle2} />
        <MetricCard label="With blockers" value={String(blocked)} detail="technical or land evidence" tone="coral" icon={AlertTriangle} />
        <MetricCard label="Unallocated" value={String(unallocated)} detail="awaiting allocation" tone="sand" icon={Target} />
      </div>

      <section className="panel sites-panel">
        <div className="table-toolbar">
          <div>
            <SectionEyebrow>Readiness register</SectionEyebrow>
            <h2>Project sites requiring attention</h2>
          </div>
          <button
            className="button button-quiet"
            type="button"
            onClick={() => notify("Advanced filters open in Phase 2")}
          >
            <Filter size={15} />
            Filter
          </button>
        </div>

        <div className="site-list">
          <div className="site-row site-row-header">
            <span>Site / project</span>
            <span>Allocation</span>
            <span>Gates</span>
            <span>Technical evidence</span>
            <span>Last review</span>
            <span />
          </div>
          {rows.map(({ c, open }) => (
            <div className="site-row" key={c.id}>
              <div>
                <strong>{c.site}</strong>
                <span>{c.project}</span>
              </div>
              <span>{c.name}</span>
              <StatusPill
                label={open.length === 0 ? "Ready" : `${open.length} open`}
                tone={open.length === 0 ? "success" : open.length > 1 ? "danger" : "warning"}
              />
              <span>{open[0]?.label ?? "Approved"}</span>
              <span>{c.updated}</span>
              <button
                type="button"
                className="icon-button small"
                onClick={() => navigate(`/cases/${c.id}`)}
                aria-label={`Open ${c.id}`}
              >
                <ArrowRight size={15} />
              </button>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="site-row" style={{ gridTemplateColumns: "1fr" }}>
              <span style={{ color: "var(--muted)" }}>No allocated sites in the demo dataset.</span>
            </div>
          )}
        </div>
      </section>
    </>
  );
}