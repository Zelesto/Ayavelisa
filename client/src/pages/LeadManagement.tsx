import { useMemo, useState } from "react";
import {
  AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, FileSpreadsheet,
  MapPin, Search, Users,
} from "lucide-react";
import { useStore } from "@/lib/store";
import type { BeneficiaryLead, LeadStatus } from "@/lib/types";
import { SectionEyebrow, useToast } from "@/components/ui";

const LEAD_STATUSES: LeadStatus[] = [
  "New",
  "Assigned",
  "Visit pending",
  "Survey in progress",
  "Survey submitted",
  "Unreachable",
  "Visit unsuccessful",
  "Refused participation",
  "On hold",
  "Converted",
];

function leadTone(status: LeadStatus) {
  if (status === "Converted" || status === "Survey submitted") return "success";
  if (status === "Visit pending" || status === "Assigned" || status === "Survey in progress") return "active";
  if (status === "Unreachable" || status === "Visit unsuccessful" || status === "Refused participation") return "attention";
  if (status === "On hold") return "muted";
  return "new";
}

function sourceTone(status: BeneficiaryLead["sourceStatus"]) {
  if (status === "Approved") return "success";
  if (status === "Failed searches") return "attention";
  if (status === "Query pending") return "muted";
  return "active";
}

function displayName(lead: BeneficiaryLead) {
  const names = lead.fullNames.trim();
  const surname = lead.surname.trim();
  const lastName = names.split(/\s+/).at(-1)?.toLowerCase();
  return surname && lastName !== surname.toLowerCase() ? `${names} ${surname}` : names || surname;
}

export default function LeadManagement() {
  const { leadImportBatches, beneficiaryLeads } = useStore();
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "All">("All");

  const filteredLeads = useMemo(() => {
    const search = query.trim().toLowerCase();
    return beneficiaryLeads.filter((lead) => {
      const matchesSearch = !search || [
        lead.fullNames,
        lead.surname,
        lead.leadRef,
        lead.project,
        lead.siteNo,
        lead.township,
        lead.assignedTo ?? "",
      ].some((value) => value.toLowerCase().includes(search));
      return matchesSearch && (statusFilter === "All" || lead.leadStatus === statusFilter);
    });
  }, [beneficiaryLeads, query, statusFilter]);

  const assignedCount = beneficiaryLeads.filter((lead) => lead.assignedTo).length;
  const awaitingCount = beneficiaryLeads.filter(
    (lead) => lead.leadStatus === "Visit pending" || lead.leadStatus === "Assigned",
  ).length;
  const duplicateCount = beneficiaryLeads.filter((lead) => lead.duplicateFlag).length;

  return (
    <div className="page-stack lead-workspace">
      <header className="lead-hero">
        <div className="lead-hero-copy">
          <SectionEyebrow>Beneficiary leads · Departmental intake</SectionEyebrow>
          <h1>Lead management</h1>
          <p>Track incoming beneficiary records and field follow-up in one place.</p>
        </div>
        <div className="lead-hero-actions">
          <button
            type="button"
            className="button button-quiet"
            onClick={() => notify("Duplicate review opens in Phase 2")}
          >
            <CheckCircle2 size={15} /> Review duplicates
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => notify("Departmental lead import opens in Phase 1")}
          >
            <ArrowUpRight size={15} /> Import lead list
          </button>
        </div>
      </header>

      <section className="lead-metrics" aria-label="Lead summary">
        <article className="lead-metric">
          <span className="lead-metric-icon lead-icon-ink"><Users size={17} /></span>
          <div><span>Total leads</span><strong>{beneficiaryLeads.length}</strong></div>
          <small>in the register</small>
        </article>
        <article className="lead-metric">
          <span className="lead-metric-icon lead-icon-sage"><CheckCircle2 size={17} /></span>
          <div><span>Assigned</span><strong>{assignedCount}</strong></div>
          <small>with a fieldworker</small>
        </article>
        <article className="lead-metric">
          <span className="lead-metric-icon lead-icon-sand"><Clock3 size={17} /></span>
          <div><span>Awaiting visit</span><strong>{awaitingCount}</strong></div>
          <small>ready for follow-up</small>
        </article>
        <article className="lead-metric">
          <span className="lead-metric-icon lead-icon-coral"><AlertTriangle size={17} /></span>
          <div><span>Duplicate flags</span><strong>{duplicateCount}</strong></div>
          <small>need a review</small>
        </article>
      </section>

      <section className="panel lead-panel">
        <div className="lead-section-heading">
          <div>
            <SectionEyebrow>Field allocation</SectionEyebrow>
            <h2>Beneficiary leads</h2>
            <p>Search the register or filter by follow-up status.</p>
          </div>
          <span className="lead-result-count">{filteredLeads.length} of {beneficiaryLeads.length}</span>
        </div>

        <div className="lead-toolbar">
          <label className="lead-search">
            <Search size={16} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, lead, project or site"
              aria-label="Search beneficiary leads"
            />
          </label>
          <label className="lead-filter">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as LeadStatus | "All")}
              aria-label="Filter leads by status"
            >
              <option value="All">All statuses</option>
              {LEAD_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>

        {filteredLeads.length > 0 ? (
          <div className="lead-card-grid">
            {filteredLeads.map((lead) => (
              <article className="lead-card" key={lead.id}>
                <div className="lead-card-top">
                  <div className="lead-avatar" aria-hidden="true">
                    {lead.fullNames.trim().charAt(0)}{lead.surname.trim().charAt(0)}
                  </div>
                  <div className="lead-card-person">
                    <h3>{displayName(lead)}</h3>
                    <span>{lead.leadRef}</span>
                  </div>
                  <span className={`lead-status lead-status-${leadTone(lead.leadStatus)}`}>{lead.leadStatus}</span>
                </div>

                <div className="lead-card-details">
                  <div>
                    <span>Project</span>
                    <strong>{lead.project}</strong>
                  </div>
                  <div>
                    <span>Site / area</span>
                    <strong><MapPin size={13} />{lead.siteNo || lead.township || "Not recorded"}</strong>
                  </div>
                </div>

                <div className="lead-card-footer">
                  <div className="lead-assignee">
                    <span>Assigned to</span>
                    <strong>{lead.assignedTo ?? "Unassigned"}</strong>
                  </div>
                  <div className="lead-card-flags">
                    <span className={`lead-status lead-status-${sourceTone(lead.sourceStatus)}`}>{lead.sourceStatus}</span>
                    {lead.duplicateFlag && <span className="lead-duplicate"><AlertTriangle size={12} /> Duplicate</span>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="lead-empty">
            <span><Search size={19} /></span>
            <h3>{beneficiaryLeads.length ? "No leads match your search" : "No beneficiary leads yet"}</h3>
            <p>{beneficiaryLeads.length ? "Try a different name or status filter." : "Imported leads will appear here after the first list is processed."}</p>
            {(query || statusFilter !== "All") && (
              <button type="button" className="button button-quiet" onClick={() => { setQuery(""); setStatusFilter("All"); }}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </section>

      <section className="panel lead-panel lead-batches">
        <div className="lead-section-heading">
          <div>
            <SectionEyebrow>Import history</SectionEyebrow>
            <h2>Source batches</h2>
            <p>Every lead stays linked to its original departmental list.</p>
          </div>
          <span className="lead-result-count">{leadImportBatches.length} {leadImportBatches.length === 1 ? "batch" : "batches"}</span>
        </div>

        {leadImportBatches.length > 0 ? (
          <div className="batch-card-grid">
            {leadImportBatches.map((batch) => (
              <article className="batch-card" key={batch.id}>
                <div className="batch-card-top">
                  <span className="batch-icon"><FileSpreadsheet size={16} /></span>
                  <span className="lead-status lead-status-success">Accepted</span>
                </div>
                <span className="batch-reference">{batch.batchRef}</span>
                <h3>{batch.project}</h3>
                <p className="batch-file" title={batch.sourceFileName}>{batch.sourceFileName}</p>
                <div className="batch-card-stats">
                  <div><strong>{batch.rowCount}</strong><span>Rows</span></div>
                  <div><strong>{batch.acceptedCount}</strong><span>Accepted</span></div>
                  <div><strong>{batch.rejectedCount + batch.duplicateCount}</strong><span>Needs review</span></div>
                </div>
                <div className="batch-card-footer">
                  <span>{batch.importingUser}</span>
                  <time dateTime={batch.importedAt}>
                    {new Date(batch.importedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                  </time>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="lead-empty lead-empty-compact">
            <span><FileSpreadsheet size={19} /></span>
            <h3>No import batches yet</h3>
            <p>Departmental lead batches will appear here once imported.</p>
          </div>
        )}
      </section>
    </div>
  );
}
