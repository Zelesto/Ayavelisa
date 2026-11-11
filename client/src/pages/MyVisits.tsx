import { useMemo, useState } from "react";
import { ArrowRight, MapPin, Search, X } from "lucide-react";
import { navigate } from "@/lib/router";
import { useStore } from "@/lib/store";
import { SectionEyebrow, StatusPill, cx } from "@/components/ui";

function toneFor(status: string) {
  if (status === "approved") return "success" as const;
  if (status === "captured") return "info" as const;
  if (status === "returned") return "danger" as const;
  if (status === "in_progress") return "warning" as const;
  return "neutral" as const;
}

export default function MyVisits() {
  const { visits, cases } = useStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  const caseById = useMemo(() => {
    const map = new Map<string, (typeof cases)[number]>();
    for (const c of cases) map.set(c.id, c);
    return map;
  }, [cases]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return visits
      .filter((v) => {
        const c = caseById.get(v.caseId);
        const hay = `${c?.name ?? ""} ${v.caseId} ${v.id} ${c?.location ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
        if (filter === "All") return true;
        if (filter === "To do") return v.status === "assigned" || v.status === "returned" || v.status === "in_progress";
        if (filter === "Awaiting review") return v.status === "captured";
        if (filter === "Approved") return v.status === "approved";
        return true;
      })
      .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  }, [visits, caseById, query, filter]);

  const isFiltered = query.length > 0 || filter !== "All";
  const resetFilters = () => { setQuery(""); setFilter("All"); };

  return (
    <>
      <div className="page-heading">
        <div>
          <SectionEyebrow>Field / Assignments</SectionEyebrow>
          <h1>My visits</h1>
          <p>Every visit you own across all statuses. Tap a row to open the capture wizard.</p>
        </div>
      </div>

      <section className="panel cases-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, case, location"
              aria-label="Search visits"
            />
          </div>
          <div className="toolbar-actions">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter">
              <option>All</option>
              <option>To do</option>
              <option>Awaiting review</option>
              <option>Approved</option>
            </select>
            <button
              type="button"
              className="button button-quiet"
              onClick={resetFilters}
              disabled={!isFiltered}
            >
              <X size={15} /> Clear
            </button>
          </div>
        </div>

        <div className="visit-list">
          {filtered.map((v) => {
            const c = caseById.get(v.caseId);
            const scheduled = new Date(v.scheduledFor);
            const dateLabel = scheduled.toLocaleDateString("en-ZA", { day: "2-digit", month: "short" });
            const timeLabel = scheduled.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
            return (
              <button
                key={v.id}
                className={cx("visit-row", "visit-row-large")}
                type="button"
                onClick={() => navigate(`/field/visits/${v.id}`)}
              >
                <div className="visit-time">
                  {dateLabel}
                  <br />
                  <span>{timeLabel}</span>
                </div>
                <div className="visit-main">
                  <strong>{c?.name ?? v.caseId}</strong>
                  <span>
                    <MapPin size={11} style={{ verticalAlign: "-1px" }} />{" "}
                    {c?.location ?? "Unknown"} · {v.caseId} · {v.id}
                  </span>
                </div>
                <StatusPill label={v.status.replaceAll("_", " ")} tone={toneFor(v.status)} />
                <ArrowRight size={15} style={{ color: "var(--muted)" }} />
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: 24, color: "var(--muted)", textAlign: "center" }}>
              No visits match the current filter.
            </div>
          )}
        </div>
      </section>
    </>
  );
}