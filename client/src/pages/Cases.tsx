import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, LockKeyhole, Plus, Search, X } from "lucide-react";
import { navigate, useSearchParams } from "@/lib/router";
import { useStore } from "@/lib/store";
import { SectionEyebrow, StatusPill, cx, useToast } from "@/components/ui";
import { exportCases, type ExportFormat } from "@/lib/caseExport";
import type { CaseRecord } from "@/lib/types";

type CaseDraft = Pick<CaseRecord, "name" | "household" | "project" | "location" | "source" | "members" | "site">;
const EMPTY_CASE: CaseDraft = { name: "", household: "", project: "", location: "", source: "", members: 1, site: "Unallocated" };

export default function Cases({ onNewIntake }: { onNewIntake: () => void }) {
  const { cases, createCase, updateCaseRecord, archiveCase, restoreCase, assignCases, runVerifyNowChecks } = useStore();
  const { notify } = useToast();
  const params = useSearchParams();
  const filterParam = params.get("filter") ?? "All cases";
  const [filter, setFilter] = useState(filterParam);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editor, setEditor] = useState<{ id: string | null; draft: CaseDraft } | null>(null);
  const [assignee, setAssignee] = useState("Thandi Ndlovu");

  useEffect(() => {
    setFilter(filterParam);
  }, [filterParam]);

  const filtered = useMemo(
    () =>
      cases.filter((item) => {
        const haystack = `${item.name} ${item.id} ${item.project} ${item.location}`.toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
        if (filter === "Archived") return !!item.archivedAt;
        if (item.archivedAt) return false;
        if (filter === "All cases") return true;
        if (filter === "Needs action") return item.nextAction !== "Confirm builder pack";
        return item.verification === filter;
      }),
    [cases, query, filter],
  );

  const isFiltered = query.length > 0 || filter !== "All cases";
  const clearAll = () => { setQuery(""); setFilter("All cases"); };

  const exportSelection = async (format: ExportFormat, records = filtered) => {
    if (records.length === 0) { notify("There are no cases to export", "error"); return; }
    try {
      await exportCases(records, format, `ayavelisa-cases-${new Date().toISOString().slice(0, 10)}`);
      notify(`Exported ${records.length} case(s)`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not export cases", "error");
    }
  };
  const toggleSelected = (id: string) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  const toggleAll = () => setSelectedIds((ids) => filtered.every((item) => ids.includes(item.id))
    ? ids.filter((id) => !filtered.some((item) => item.id === id))
    : [...new Set([...ids, ...filtered.map((item) => item.id)])]);
  const selectedCases = cases.filter((item) => selectedIds.includes(item.id) && !item.archivedAt);
  const saveCase = () => {
    if (!editor) return;
    const draft = { ...editor.draft, name: editor.draft.name.trim(), household: editor.draft.household.trim() };
    if (!draft.name || !draft.project.trim() || !draft.location.trim()) { notify("Applicant, project, and location are required", "error"); return; }
    try {
      if (editor.id) updateCaseRecord(editor.id, draft);
      else createCase(draft);
      setEditor(null);
      notify(editor.id ? "Case changes saved" : "Case created");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save case", "error");
    }
  };
  const runBulkVerify = () => {
    if (!selectedCases.length) return;
    const results = runVerifyNowChecks(selectedCases.map((item) => item.id));
    setSelectedIds([]);
    notify(`Recorded ${results.length} VerifyNow request(s). The provider API is not configured; no external checks were performed.`, "error");
  };
  const runBulkAssign = () => {
    if (!selectedCases.length) return;
    assignCases(selectedCases.map((item) => item.id), assignee);
    setSelectedIds([]);
    notify(`Assigned ${selectedCases.length} case(s) to ${assignee}`);
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <SectionEyebrow>Beneficiaries / Register</SectionEyebrow>
          <h1>Beneficiary cases</h1>
          <p>One controlled record across intake, verification, subsidy, site and dwelling.</p>
        </div>
        <div className="heading-actions">
          <button className="button button-quiet" type="button" onClick={onNewIntake}>
            <Plus size={17} /> New intake
          </button>
          <button className="button button-primary" type="button" onClick={() => setEditor({ id: null, draft: EMPTY_CASE })}>
            <Plus size={17} /> New case
          </button>
        </div>
      </div>

      <div className="notice-banner compact">
        <div className="notice-symbol">
          <LockKeyhole size={15} />
        </div>
        <div>
          <strong>Access scope: Eastern Cape · assigned projects</strong>
          <span>Personal documents and household details are visible only where your role permits.</span>
        </div>
        <button className="notice-link" type="button" onClick={() => navigate("/configuration")}>
          View access rules <ArrowRight size={14} />
        </button>
      </div>

      <section className="panel cases-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search reference, name, project or ward"
              aria-label="Search beneficiary cases"
            />
          </div>
          <div className="toolbar-actions">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label="Filter beneficiary cases"
            >
              <option>All cases</option>
              <option>Needs action</option>
              <option>Internally verified</option>
              <option>Awaiting review</option>
              <option>Unresolved classification</option>
              <option>Archived</option>
            </select>
            <button
              type="button"
              className="button button-quiet"
              onClick={clearAll}
              disabled={!isFiltered}
            >
              <X size={15} /> Clear
            </button>
          </div>
        </div>

        {selectedCases.length > 0 && (
          <div className="bulk-toolbar" aria-label="Bulk case actions">
            <strong>{selectedCases.length} selected</strong>
            <button type="button" className="button button-outline" onClick={runBulkVerify}>Run VerifyNow</button>
            <select value={assignee} onChange={(event) => setAssignee(event.target.value)} aria-label="Assign selected cases to">
              <option>Lindiwe Ndlovu</option><option>Thandi Ndlovu</option><option>Sipho Mahlangu</option>
            </select>
            <button type="button" className="button button-outline" onClick={runBulkAssign}>Assign</button>
            <button type="button" className="button button-outline" onClick={() => void exportSelection("xlsx", selectedCases)}>Excel</button>
            <button type="button" className="button button-outline" onClick={() => void exportSelection("pdf", selectedCases)}>PDF</button>
            <button type="button" className="button button-outline" onClick={() => void exportSelection("csv", selectedCases)}>CSV</button>
            <button
              type="button"
              className="button button-quiet"
              onClick={() => {
                selectedCases.forEach((item) => archiveCase(item.id));
                setSelectedIds([]);
                notify("Selected cases archived");
              }}
            >
              Archive selected
            </button>
            <button type="button" className="text-button" onClick={() => setSelectedIds([])}>Clear selection</button>
          </div>
        )}

        <div className="case-table-wrap">
          <table className="case-table">
            <thead>
              <tr>
                <th><input type="checkbox" aria-label="Select all visible cases" checked={filtered.length > 0 && filtered.every((item) => selectedIds.includes(item.id))} onChange={toggleAll} /></th>
                <th>Case / household</th>
                <th>Project &amp; place</th>
                <th>Verification</th>
                <th>Subsidy status</th>
                <th>Readiness</th>
                <th>Next action</th>
                <th>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item: CaseRecord) => (
                <tr
                  key={item.id}
                  tabIndex={0}
                  aria-label={`Open case ${item.id}`}
                  onClick={() => navigate(`/cases/${item.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/cases/${item.id}`);
                    }
                  }}
                >
                  <td onClick={(event) => event.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} aria-label={`Select case ${item.id}`} />
                  </td>
                  <td>
                    <div className="case-primary">
                      <span className="case-avatar">
                        {item.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </span>
                      <div>
                        <strong>{item.name}</strong>
                        <span>
                          {item.id} · {item.members} household members
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <strong>{item.project}</strong>
                      <span>{item.location}</span>
                    </div>
                  </td>
                  <td>
                    <StatusPill label={item.verification} tone={item.verificationTone} />
                  </td>
                  <td>
                    <StatusPill label={item.subsidy} tone={item.subsidyTone} />
                  </td>
                  <td>
                    <span
                      className={cx(
                        "readiness-text",
                        item.readiness.startsWith("Ready")
                          ? "ready"
                          : /Blocked|Exception/.test(item.readiness)
                            ? "blocked"
                            : "muted",
                      )}
                    >
                      {item.readiness}
                    </span>
                  </td>
                  <td>
                    <span className="next-action">
                      {item.nextAction}
                      <ArrowUpRight size={13} />
                    </span>
                  </td>
                  <td className="case-actions-cell" onClick={(event) => event.stopPropagation()}>
                    {item.archivedAt ? (
                      <button type="button" className="text-button" onClick={() => { restoreCase(item.id); notify("Case restored"); }}>Restore</button>
                    ) : (
                      <>
                        <button type="button" className="text-button" onClick={() => setEditor({ id: item.id, draft: { name: item.name, household: item.household, project: item.project, location: item.location, source: item.source, members: item.members, site: item.site } })}>Edit</button>
                        <button type="button" className="text-button" onClick={() => { archiveCase(item.id); notify("Case archived"); }}>Archive</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--muted)", padding: "28px" }}>
                    No cases match the current search or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>
            Showing {filtered.length} of {cases.filter((item) => filter === "Archived" ? !!item.archivedAt : !item.archivedAt).length} cases
          </span>
          <div className="export-actions">
            <button type="button" className="text-button" onClick={() => void exportSelection("xlsx")}>Excel</button>
            <button type="button" className="text-button" onClick={() => void exportSelection("pdf")}>PDF</button>
            <button type="button" className="text-button" onClick={() => void exportSelection("csv")}>CSV <ArrowUpRight size={13} /></button>
          </div>
        </div>
      </section>

      {editor && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}>
          <section className="case-editor panel" role="dialog" aria-modal="true" aria-labelledby="case-editor-title">
            <div className="panel-header">
              <div><SectionEyebrow>Beneficiary record</SectionEyebrow><h2 id="case-editor-title">{editor.id ? `Edit ${editor.id}` : "Create case"}</h2></div>
              <button type="button" className="icon-button" aria-label="Close case editor" onClick={() => setEditor(null)}><X size={16} /></button>
            </div>
            <div className="form-grid">
              <label className="capture-field"><span>Applicant name *</span><input value={editor.draft.name} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, name: event.target.value } })} /></label>
              <label className="capture-field"><span>Household name</span><input value={editor.draft.household} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, household: event.target.value } })} /></label>
              <label className="capture-field"><span>Project *</span><input value={editor.draft.project} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, project: event.target.value } })} /></label>
              <label className="capture-field"><span>Location *</span><input value={editor.draft.location} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, location: event.target.value } })} /></label>
              <label className="capture-field"><span>Source</span><input value={editor.draft.source} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, source: event.target.value } })} /></label>
              <label className="capture-field"><span>Household members</span><input type="number" min="1" value={editor.draft.members} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, members: Math.max(1, Number(event.target.value)) } })} /></label>
              <label className="capture-field"><span>Site</span><input value={editor.draft.site} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, site: event.target.value } })} /></label>
            </div>
            <div className="capture-submit-row">
              <button type="button" className="button button-quiet" onClick={() => setEditor(null)}>Cancel</button>
              <button type="button" className="button button-primary" onClick={saveCase}>Save case</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}