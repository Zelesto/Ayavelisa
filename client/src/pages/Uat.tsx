import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, Play, PlayCircle, XCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import { UAT_TESTS, runUat, type UatResult, type UatStatus } from "@/lib/uat";
import { SectionEyebrow, useToast } from "@/components/ui";

function statusTone(s: UatStatus) {
  switch (s) {
    case "passed": return { color: "var(--sage)", bg: "var(--sage-light)", icon: CheckCircle2, label: "PASSED" };
    case "failed": return { color: "var(--danger)", bg: "var(--danger-light)", icon: XCircle, label: "FAILED" };
    case "requires_external": return { color: "var(--blue)", bg: "var(--blue-light)", icon: ExternalLink, label: "EXTERNAL" };
    case "running": return { color: "var(--sand)", bg: "var(--sand-light)", icon: Clock, label: "RUNNING" };
    default: return { color: "var(--muted-dark)", bg: "var(--paper-deep)", icon: Clock, label: "NOT RUN" };
  }
}

export default function Uat() {
  const store = useStore();
  const { notify } = useToast();
  const [results, setResults] = useState<Record<string, UatResult>>({});
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const runOne = async (id: string) => {
    const test = UAT_TESTS.find(t => t.id === id);
    if (!test) return;
    setRunning(prev => new Set(prev).add(id));
    setResults(prev => ({ ...prev, [id]: { ...(prev[id] ?? { id: test.id, name: test.name, clause: test.clause, description: test.description, expected: test.expected, finishedAt: null, evidence: [], failure: null }), status: "running", startedAt: new Date().toISOString() } }));
    const result = await runUat(test, store);
    setResults(prev => ({ ...prev, [id]: result }));
    setExpanded(prev => new Set(prev).add(id));
    setRunning(prev => { const n = new Set(prev); n.delete(id); return n; });
    notify(`${id}: ${result.status.toUpperCase()}`);
  };

  const runAll = async () => {
    notify("Running all 15 UAT scenarios sequentiallyâ€¦");
    for (const t of UAT_TESTS) { await runOne(t.id); }
    notify("UAT batch complete");
  };

  const toggle = (id: string) => setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const statuses = Object.values(results).map(r => r.status);
  const passed = statuses.filter(s => s === "passed").length;
  const failed = statuses.filter(s => s === "failed").length;
  const external = statuses.filter(s => s === "requires_external").length;
  const notRun = UAT_TESTS.length - Object.keys(results).length;

  return (
    <>
      <div className="page-heading">
        <div>
          <SectionEyebrow>UAT / Acceptance</SectionEyebrow>
          <h1>User acceptance testing</h1>
          <p>Each scenario runs against a working copy of the demo state, executes the workflow, and records an evidence trail. Demo state is not modified.</p>
        </div>
        <div className="heading-actions">
          <button className="button button-primary" onClick={runAll} disabled={running.size > 0}>
            <PlayCircle size={16} /> {running.size > 0 ? "Runningâ€¦" : "Run all 15"}
          </button>
        </div>
      </div>

      <div className="uat-summary">
        <div className="uat-summary-card"><span>Passed</span><strong style={{ color: "var(--sage)" }}>{passed}</strong></div>
        <div className="uat-summary-card"><span>Failed</span><strong style={{ color: "var(--danger)" }}>{failed}</strong></div>
        <div className="uat-summary-card"><span>Requires external</span><strong style={{ color: "var(--blue)" }}>{external}</strong></div>
        <div className="uat-summary-card"><span>Not yet run</span><strong style={{ color: "var(--muted-dark)" }}>{notRun}</strong></div>
      </div>

      <div className="uat-list">
        {UAT_TESTS.map(t => {
          const r = results[t.id];
          const st = statusTone(r?.status ?? "not_run");
          const Icon = st.icon;
          const isRunning = running.has(t.id);
          const isExpanded = expanded.has(t.id);
          return (
            <div className="uat-card" key={t.id}>
              <div className="uat-card-head">
                <div className="uat-card-title">
                  <span className="uat-id">{t.id}</span>
                  <div>
                    <strong>{t.name}</strong>
                    <span className="uat-clause">Clause: {t.clause}</span>
                  </div>
                </div>
                <div className="uat-card-actions">
                  <span className="uat-status" style={{ color: st.color, background: st.bg }}>
                    <Icon size={12} /> {st.label}
                  </span>
                  <button className="button button-quiet uat-run" onClick={() => runOne(t.id)} disabled={isRunning}>
                    <Play size={13} /> {isRunning ? "Runningâ€¦" : r ? "Re-run" : "Run"}
                  </button>
                </div>
              </div>
              <p className="uat-desc">{t.description}</p>
              <div className="uat-expect"><strong>Expected:</strong> {t.expected}</div>
              {r && (
                <>
                  <button className="text-button uat-evidence-toggle" onClick={() => toggle(t.id)}>
                    {isExpanded ? "Hide" : "Show"} evidence ({r.evidence.length}) Â· {r.finishedAt ? new Date(r.finishedAt).toLocaleTimeString() : ""}
                  </button>
                  {isExpanded && (
                    <ol className="uat-evidence">
                      {r.evidence.map((e, i) => <li key={i}>{e}</li>)}
                      {r.failure && <li className="uat-failure">Failure: {r.failure}</li>}
                    </ol>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <section className="panel" style={{ padding: 20, marginTop: 18 }}>
        <div className="panel-header">
          <div><SectionEyebrow>UAT Notes</SectionEyebrow><h2>What UAT15 requires outside the browser</h2></div>
          <AlertTriangle size={18} style={{ color: "var(--sand)" }} />
        </div>
        <p style={{ color: "var(--muted-dark)", fontSize: 11, lineHeight: 1.55 }}>
          UAT15 (performance, concurrency, device matrix, independent penetration test) cannot be demonstrated inside a browser demo. When presenting, run tests 1â€“14 here, then hand over the environment-dependent items using the UAT15 checklist shown in the evidence panel. This is the honest boundary of a demo â€” it protects you from claiming a pass you can't evidence.
        </p>
      </section>
    </>
  );
}