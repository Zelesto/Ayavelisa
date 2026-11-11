import { useEffect, useState } from "react";
import {
  ArrowRight, Bell, CalendarDays, ChevronDown, ClipboardCheck, ClipboardList, Database, FileText,
  LayoutDashboard, Map, Menu, MoreHorizontal, RefreshCw, SlidersHorizontal, Users, Wifi, WifiOff, X,
} from "lucide-react";
import { navigate, useRoute } from "@/lib/router";
import { StoreProvider, useStore, USERS } from "@/lib/store";
import { ToastProvider, cx } from "@/components/ui";
import Overview from "@/pages/Overview";
import Cases from "@/pages/Cases";
import CaseDetail from "@/pages/CaseDetail";
import Sites from "@/pages/Sites";
import Reports from "@/pages/Reports";
import Configuration from "@/pages/Configuration";
import LeadManagement from "@/pages/LeadManagement";
import FieldHome from "@/pages/FieldHome";
import MyVisits from "@/pages/MyVisits";
import VisitCapture from "@/pages/VisitCapture";
import ReviewQueue from "@/pages/ReviewQueue";
import IntakeReview from "@/pages/IntakeReview";
import FieldIntake from "@/pages/FieldIntake";
import type { Persona } from "@/lib/types";

type NavItem = { label: string; icon: typeof LayoutDashboard; path: string; count?: string; forPersona?: Persona[] };

const HOME: Record<Persona, string> = {
  fieldworker: "/field",
  supervisor: "/",
  reviewer: "/review",
};

function Shell() {
  const { path } = useRoute();
  const { sync, isSyncing, isOnline, persona, setPersona, currentUser, databaseStatus, databaseError, retryDatabase } = useStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (path === "/" && persona === "fieldworker") navigate("/field");
  }, [path, persona]);

  if (databaseStatus === "loading") {
    return (
      <main className="database-loading" role="status">
        <Database size={22} />
        <strong>Opening your shared workspace</strong>
        <span>Connecting to the database…</span>
      </main>
    );
  }

  const nav: NavItem[] = persona === "fieldworker"
    ? [
        { label: "Today", icon: LayoutDashboard, path: "/field" },
        { label: "My visits", icon: ClipboardList, path: "/field/visits" },
        { label: "Assigned leads", icon: FileText, path: "/leads" },
        { label: "My cases", icon: Users, path: "/cases" },
      ]
    : persona === "reviewer"
      ? [
          { label: "Review queue", icon: ClipboardCheck, path: "/review" },
          { label: "Intake review", icon: ClipboardList, path: "/review/intake" },
          { label: "Cases", icon: Users, path: "/cases" },
          { label: "Beneficiary leads", icon: FileText, path: "/leads" },
          { label: "Sites", icon: Map, path: "/sites" },
          { label: "Reports", icon: FileText, path: "/reports" },
        ]
      : [
          { label: "Overview", icon: LayoutDashboard, path: "/" },
          { label: "Cases", icon: Users, path: "/cases" },
          { label: "Beneficiary leads", icon: FileText, path: "/leads" },
          { label: "Review queue", icon: ClipboardCheck, path: "/review" },
          { label: "Intake review", icon: ClipboardList, path: "/review/intake" },
          { label: "Sites & readiness", icon: Map, path: "/sites" },
          { label: "Reports", icon: FileText, path: "/reports" },
          { label: "Configuration", icon: SlidersHorizontal, path: "/configuration" },
        ];

  const activePath = path;
  const caseMatch = path.match(/^\/cases\/([^/]+)$/);
  const visitMatch = path.match(/^\/field\/visits\/([^/]+)$/);
  const intakeMatch = path.match(/^\/intake\/([^/]+)$/);

  const content = (() => {
    if (path === "/field") return <FieldHome />;
    if (path === "/field/visits") return <MyVisits />;
    if (visitMatch) return <VisitCapture visitId={decodeURIComponent(visitMatch[1])} />;
    if (path === "/review") return <ReviewQueue />;
    if (path === "/review/intake") return <IntakeReview />;
    if (path === "/intake") return <FieldIntake />;
    if (intakeMatch) return <FieldIntake intakeId={decodeURIComponent(intakeMatch[1])} />;
    if (path === "/leads") return <LeadManagement />;
    if (path === "/") return persona === "fieldworker" ? <FieldHome /> : <Overview onNewIntake={() => navigate("/intake")} />;
    if (path === "/cases") return <Cases onNewIntake={() => navigate("/intake")} />;
    if (caseMatch) return <CaseDetail caseId={decodeURIComponent(caseMatch[1])} />;
    if (path === "/sites") return <Sites />;
    if (path === "/reports") return <Reports />;
    if (path === "/configuration") return <Configuration />;
    return (
      <div className="missing-state">
        <h2>Page not found</h2>
        <p>The route {path} is not registered.</p>
        <button className="button button-primary" type="button" onClick={() => navigate(HOME[persona])}>Go home</button>
      </div>
    );
  })();

  const switchTo = (p: Persona) => {
    setPersona(p);
    navigate(HOME[p]);
    setMobileNavOpen(false);
  };

  const breadcrumbLabel = (() => {
    if (caseMatch) return "Case file";
    if (visitMatch) return "Visit capture";
    if (path === "/intake" || intakeMatch) return "New intake";
    if (path === "/review/intake") return "Intake review";
    return nav.find((n) => path === n.path)?.label
      ?? (path === "/review" ? "Review queue" : "Field");
  })();

  return (
    <div className="app-shell">
      <aside className={cx("sidebar", mobileNavOpen && "sidebar-open")}>
        <div className="brand">
          <div className="brand-mark"><span>A</span><span>V</span></div>
          <div><strong>ayavelisa</strong><span>human settlements</span></div>
          <button className="mobile-close icon-button" type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={17} /></button>
        </div>
        <div className="sidebar-context">
          <span className="context-label">WORKSPACE</span>
          <button type="button" className="workspace-switch"><span className="workspace-dot" />Eastern Cape delivery<ChevronDown size={14} /></button>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {nav.map(({ label, icon: Icon, count, path: p }) => (
            <button
              type="button" key={label}
              className={cx("nav-item", (activePath === p || (p !== "/" && activePath.startsWith(`${p}/`))) && "nav-active")}
              onClick={() => { setMobileNavOpen(false); navigate(p); }}
            >
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{count && <em>{count}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-rule" />
        <div className="sidebar-section-label">QUICK ACCESS</div>
        <button type="button" className="nav-item" onClick={() => { setMobileNavOpen(false); navigate(persona === "fieldworker" ? "/field/visits?filter=To do" : "/cases?filter=Needs%20action"); }}>
          <ClipboardCheck size={17} strokeWidth={1.8} /><span>My assignments</span><em className="nav-alert">8</em>
        </button>
        <button type="button" className="nav-item"><Bell size={17} strokeWidth={1.8} /><span>Notifications</span><em className="nav-alert">3</em></button>
        <div className="sidebar-bottom">
          <div className="role-card">
            <div className="avatar">{currentUser.initials}</div>
            <div><strong>{currentUser.name}</strong><span>{currentUser.role}</span></div>
            <MoreHorizontal size={16} />
          </div>
          <div className="sidebar-footer">
            <span>{isOnline ? <><Wifi size={13} />Connected</> : <><WifiOff size={13} />Offline</>}</span>
            <span>v0.3 demo</span>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button className="mobile-menu icon-button" type="button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div className="breadcrumbs">
            <span>Ayavelisa</span><ArrowRight size={13} />
            <strong>{breadcrumbLabel}</strong>
          </div>
          <div className="topbar-actions">
            <div className="persona-switcher">
              {(Object.keys(USERS) as Persona[]).map((p) => (
                <button
                  key={p} type="button" onClick={() => switchTo(p)}
                  className={cx("persona-chip", persona === p && "is-active")}
                  title={USERS[p].role}
                >
                  {USERS[p].initials}
                </button>
              ))}
            </div>
            <span className="topbar-date"><CalendarDays size={14} />{new Date().toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}</span>
            <span className={cx("sync-state", isSyncing && "is-syncing", !isOnline && "is-offline")}>
              <span className="sync-dot" />
              {isSyncing ? "Syncing" : !isOnline ? "Offline" : sync.pendingUploads > 0 ? `${sync.pendingUploads} pending` : "All synced"}
            </span>
            <button
              type="button"
              className={cx("database-state", databaseStatus === "error" && "database-state-error", databaseStatus === "saving" && "database-state-saving")}
              onClick={() => { if (databaseStatus === "error") void retryDatabase(); }}
              disabled={databaseStatus !== "error"}
              title={databaseError ?? (databaseStatus === "saving" ? "Saving changes to PostgreSQL" : "All screen data is saved in PostgreSQL")}
              aria-live="polite"
            >
              <Database size={13} />
              {databaseStatus === "connected" ? "Database saved" : databaseStatus === "saving" ? "Saving to database" : "Database issue · Retry"}
            </button>
            <button type="button" className="topbar-user" aria-label="Account menu">
              <span className="avatar avatar-small">{currentUser.initials}</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
        <main className="main-content">{content}</main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </StoreProvider>
  );
}