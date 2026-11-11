import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  Activity, BeneficiaryLead, Blocker, CaseRecord, Evidence, Intake, LeadImportBatch, Persona, SeedKind, StoreState, VerifyNowResult, Visit, VisitForm,
} from "./types";
import { seedFor } from "./seeders";
import { emptyIntake } from "./intake";

const KEY = "ayavelisa:field:v2";
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const USERS: Record<Persona, { name: string; role: string; initials: string }> = {
  fieldworker: { name: "Lindiwe Ndlovu", role: "Fieldworker Â· Ndlovu Ext. 2", initials: "LN" },
  supervisor: { name: "Thandi Ndlovu", role: "Verification supervisor", initials: "TN" },
  reviewer: { name: "Sipho Mahlangu", role: "Project reviewer", initials: "SM" },
};

type Ctx = StoreState & {
  currentUser: { name: string; role: string; initials: string };
  isOnline: boolean; isSyncing: boolean;
  databaseStatus: "loading" | "connected" | "saving" | "error";
  databaseError: string | null;
  retryDatabase: () => Promise<void>;
  setPersona: (p: Persona) => void;
  setSeed: (s: SeedKind) => void;
  resetDemo: () => void;
  createCase: (draft: Pick<CaseRecord, "name" | "household" | "project" | "location" | "source" | "members" | "site">) => CaseRecord;
  updateCaseRecord: (id: string, patch: Partial<CaseRecord>) => void;
  archiveCase: (id: string) => void;
  restoreCase: (id: string) => void;
  assignCases: (ids: string[], assignee: string) => void;
  runVerifyNowChecks: (ids: string[]) => VerifyNowResult[];
  markDepartmentPacketExported: (id: string) => void;
  startVisit: (id: string) => void;
  saveVisitForm: (id: string, form: VisitForm) => void;
  addEvidence: (id: string, ev: Omit<Evidence, "id">) => void;
  removeEvidence: (id: string, evId: string) => void;
  submitVisit: (id: string) => void;
  returnVisit: (id: string, reason: string) => void;
  approveVisit: (id: string) => void;
  runSync: () => Promise<void>;
  requestBlocker: (c: string, b: string) => void;
  assignBlocker: (c: string, b: string) => void;
  resolveBlocker: (c: string, b: string) => void;
  createIntakeDraft: () => Intake;
  saveIntake: (i: Intake) => void;
  submitIntake: (id: string) => void;
  approveIntake: (id: string) => CaseRecord | null;
  returnIntake: (id: string, reason: string) => void;
  linkIntake: (id: string, caseId: string, reason: string) => void;
  discardIntake: (id: string) => void;
};

const StoreContext = createContext<Ctx | null>(null);

const isDatabaseAvailable = (status: Ctx["databaseStatus"]) => status === "connected" || status === "saving";

function load(): StoreState {
  if (typeof window === "undefined") return seedFor("mid_day");
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return seedFor("mid_day");
    const p = JSON.parse(raw) as Partial<StoreState>;
    const base = seedFor(p.seedKind ?? "mid_day");
    return {
      cases: Array.isArray(p.cases) ? p.cases : base.cases,
      blockers: p.blockers ?? base.blockers,
      activities: Array.isArray(p.activities) ? p.activities : base.activities,
      sync: p.sync ?? base.sync,
      visits: Array.isArray(p.visits) ? p.visits : base.visits,
      persona: p.persona ?? base.persona,
      seedKind: p.seedKind ?? base.seedKind,
      auditLog: Array.isArray(p.auditLog) ? p.auditLog : [],
      importBatches: Array.isArray(p.importBatches) ? p.importBatches : [],
      submissionBatches: Array.isArray(p.submissionBatches) ? p.submissionBatches : [],
      enrolments: Array.isArray(p.enrolments) ? p.enrolments : [],
      workUnits: Array.isArray(p.workUnits) ? p.workUnits : [],
      claims: Array.isArray(p.claims) ? p.claims : [],
      changeRequests: Array.isArray(p.changeRequests) ? p.changeRequests : [],
      issuedReports: Array.isArray(p.issuedReports) ? p.issuedReports : [],
      conflicts: Array.isArray(p.conflicts) ? p.conflicts : [],
      handovers: Array.isArray(p.handovers) ? p.handovers : [],
      intakes: Array.isArray(p.intakes) ? p.intakes : [],
      leadImportBatches: Array.isArray(p.leadImportBatches) ? p.leadImportBatches : [],
      beneficiaryLeads: Array.isArray(p.beneficiaryLeads) ? p.beneficiaryLeads : [],
    };
  } catch { return seedFor("mid_day"); }
}

function nextIntakeId(all: Intake[]): string {
  const year = new Date().getFullYear();
  const max = all.reduce((m, i) => { const n = Number(i.id.split("-")[2]); return Number.isFinite(n) && n > m ? n : m; }, 0);
  return `INT-${year}-${String(max + 1).padStart(4, "0")}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreState>(load);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [databaseStatus, setDatabaseStatusState] = useState<"loading" | "connected" | "saving" | "error">("loading");
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const databaseVersion = useRef(0);
  const databaseStatusRef = useRef(databaseStatus);
  const saveTimer = useRef<number | null>(null);
  const writeInProgress = useRef(false);
  const manualSyncInProgress = useRef(false);
  const pendingState = useRef<StoreState | null>(null);
  const lastSavedState = useRef<StoreState | null>(null);

  const setDatabaseStatus = useCallback((status: "loading" | "connected" | "saving" | "error", error: string | null = null) => {
    databaseStatusRef.current = status;
    setDatabaseStatusState(status);
    setDatabaseError(error);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initialize = async () => {
      try {
        const response = await fetch("/api/state", { signal: controller.signal });
        if (!response.ok) throw new Error(`Database connection failed (${response.status})`);
        const result = await response.json() as { state: StoreState | null; version: number };
        databaseVersion.current = result.version;
        if (result.state) {
          lastSavedState.current = result.state;
          setState(result.state);
        }
        setDatabaseStatus("connected");
      } catch (error) {
        if (controller.signal.aborted) return;
        setDatabaseStatus("error", error instanceof Error ? error.message : "Could not connect to the database");
      }
    };
    void initialize();
    return () => controller.abort();
  }, [setDatabaseStatus]);

  useEffect(() => {
    const up = () => setIsOnline(true); const down = () => setIsOnline(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); }
    catch { console.warn("localStorage quota exceeded"); }
  }, [state]);

  useEffect(() => {
    if ((databaseStatus !== "connected" && databaseStatus !== "saving") || state === lastSavedState.current) return;
    pendingState.current = state;
    if (databaseStatus === "connected") {
      setDatabaseStatus("saving");
      return;
    }
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);

    const flush = async () => {
      if (writeInProgress.current || manualSyncInProgress.current || !isDatabaseAvailable(databaseStatusRef.current)) return;
      writeInProgress.current = true;
      try {
        while (pendingState.current && isDatabaseAvailable(databaseStatusRef.current)) {
          const snapshot = pendingState.current;
          pendingState.current = null;
          const response = await fetch("/api/state", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ state: snapshot, version: databaseVersion.current }),
          });
          if (response.status === 409) {
            throw new Error("Shared data changed elsewhere. Reload the page to load the latest database state.");
          }
          if (!response.ok) throw new Error(`Could not save to the database (${response.status})`);
          const result = await response.json() as { version: number };
          databaseVersion.current = result.version;
          lastSavedState.current = snapshot;
        }
        if (databaseStatusRef.current === "saving") setDatabaseStatus("connected");
      } catch (error) {
        pendingState.current = pendingState.current ?? state;
        setDatabaseStatus("error", error instanceof Error ? error.message : "Could not save to the database");
      } finally {
        writeInProgress.current = false;
        if (pendingState.current && !manualSyncInProgress.current && isDatabaseAvailable(databaseStatusRef.current)) {
          saveTimer.current = window.setTimeout(() => void flush(), 0);
        }
      }
    };

    saveTimer.current = window.setTimeout(() => void flush(), 500);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [state, databaseStatus, setDatabaseStatus]);

  const retryDatabase = useCallback(async () => {
    setDatabaseStatus("loading");
    try {
      const response = await fetch("/api/state");
      if (!response.ok) throw new Error(`Database connection failed (${response.status})`);
      const result = await response.json() as { state: StoreState | null; version: number };
      if (result.version !== databaseVersion.current) {
        throw new Error("The database has newer shared data. Reload the page to load it before saving again.");
      }
      setDatabaseStatus("connected");
    } catch (error) {
      setDatabaseStatus("error", error instanceof Error ? error.message : "Could not reconnect to the database");
    }
  }, [setDatabaseStatus]);

  const act = (kind: Activity["kind"], tone: Activity["tone"], title: string, detail: string): Activity => ({
    id: uid(), kind, tone, title, detail, time: "Just now", at: new Date().toISOString(),
  });

  const setPersona = useCallback((persona: Persona) => setState((s) => ({ ...s, persona })), []);
  const setSeed = useCallback((seedKind: SeedKind) => setState(() => seedFor(seedKind)), []);
  const resetDemo = useCallback(() => setState((s) => seedFor(s.seedKind)), []);
  const createCase = useCallback((draft: Pick<CaseRecord, "name" | "household" | "project" | "location" | "source" | "members" | "site">) => {
    const year = new Date().getFullYear();
    const max = state.cases.reduce((highest, item) => {
      const [prefix, itemYear, sequence] = item.id.split("-");
      const number = prefix === "AY" && Number(itemYear) === year ? Number(sequence) : 0;
      return Number.isFinite(number) ? Math.max(highest, number) : highest;
    }, 0);
    const created: CaseRecord = {
      ...draft,
      id: `AY-${year}-${String(max + 1).padStart(4, "0")}`,
      verification: "Awaiting review",
      verificationTone: "warning",
      subsidy: "Not started",
      subsidyTone: "neutral",
      readiness: "Not started",
      nextAction: "Complete field verification",
      updated: "Just now",
    };
    setState((s) => ({
      ...s,
      cases: [created, ...s.cases],
      activities: [act("action", "blue", "Case created", created.id), ...s.activities].slice(0, 40),
      auditLog: [{
        id: uid(), at: new Date().toISOString(), actor: USERS[s.persona].name, persona: s.persona,
        action: "create", entity: "case", entityId: created.id, before: null, after: created, reason: null,
      }, ...s.auditLog],
    }));
    return created;
  }, [state.cases, state.persona]);
  const updateCaseRecord = useCallback((id: string, patch: Partial<CaseRecord>) => setState((s) => {
    const before = s.cases.find((item) => item.id === id);
    if (!before) throw new Error(`Case ${id} was not found`);
    const after = { ...before, ...patch, id, updated: "Just now" };
    return {
      ...s,
      cases: s.cases.map((item) => item.id === id ? after : item),
      activities: [act("action", "sand", "Case updated", id), ...s.activities].slice(0, 40),
      auditLog: [{
        id: uid(), at: new Date().toISOString(), actor: USERS[s.persona].name, persona: s.persona,
        action: "update", entity: "case", entityId: id, before, after, reason: null,
      }, ...s.auditLog],
    };
  }), []);
  const archiveCase = useCallback((id: string) => setState((s) => {
    const before = s.cases.find((item) => item.id === id);
    if (!before) throw new Error(`Case ${id} was not found`);
    const after = { ...before, archivedAt: new Date().toISOString(), updated: "Just now" };
    return {
      ...s,
      cases: s.cases.map((item) => item.id === id ? after : item),
      activities: [act("action", "coral", "Case archived", id), ...s.activities].slice(0, 40),
      auditLog: [{
        id: uid(), at: new Date().toISOString(), actor: USERS[s.persona].name, persona: s.persona,
        action: "archive", entity: "case", entityId: id, before, after, reason: null,
      }, ...s.auditLog],
    };
  }), []);
  const restoreCase = useCallback((id: string) => setState((s) => {
    const before = s.cases.find((item) => item.id === id);
    if (!before) throw new Error(`Case ${id} was not found`);
    const after = { ...before, archivedAt: null, updated: "Just now" };
    return {
      ...s,
      cases: s.cases.map((item) => item.id === id ? after : item),
      activities: [act("action", "sage", "Case restored", id), ...s.activities].slice(0, 40),
      auditLog: [{
        id: uid(), at: new Date().toISOString(), actor: USERS[s.persona].name, persona: s.persona,
        action: "restore", entity: "case", entityId: id, before, after, reason: null,
      }, ...s.auditLog],
    };
  }), []);
  const assignCases = useCallback((ids: string[], assignee: string) => setState((s) => ({
    ...s,
    cases: s.cases.map((item) => ids.includes(item.id) && !item.archivedAt ? { ...item, assignedTo: assignee, updated: "Just now" } : item),
    activities: [act("action", "blue", "Cases assigned", `${ids.length} case(s) · ${assignee}`), ...s.activities].slice(0, 40),
  })), []);
  const runVerifyNowChecks = useCallback((ids: string[]) => {
    const selected = new Set(ids);
    const matchingCases = state.cases.filter((item) => selected.has(item.id));
    const now = new Date().toISOString();
    const checks: VerifyNowResult[] = matchingCases.map(() => ({
      id: uid(),
      provider: "VerifyNow",
      status: "not_configured",
      outcome: "not_run",
      reference: "",
      summary: "VerifyNow API is not configured. No external identity check was performed.",
      checkedAt: now,
      checkedBy: USERS[state.persona].name,
      simulated: false,
    }));
    const checkByCase = new Map(matchingCases.map((item, index) => [item.id, checks[index]]));
    setState((s) => ({
      ...s,
      cases: s.cases.map((item) => {
        const check = checkByCase.get(item.id);
        return check ? { ...item, verifyNowChecks: [...(item.verifyNowChecks ?? []), check], updated: "Just now" } : item;
      }),
      activities: [act("verify", "sand", "VerifyNow requested", `${checks.length} case(s) · integration not configured`), ...s.activities].slice(0, 40),
    }));
    return checks;
  }, [state.cases, state.persona]);
  const markDepartmentPacketExported = useCallback((id: string) => {
    updateCaseRecord(id, { departmentPacketExportedAt: new Date().toISOString() });
  }, [updateCaseRecord]);

  const startVisit = useCallback((id: string) => setState((s) => ({ ...s, visits: s.visits.map((v) => v.id === id ? { ...v, status: v.status === "assigned" ? "in_progress" as const : v.status, startedAt: v.startedAt ?? new Date().toISOString() } : v) })), []);
  const saveVisitForm = useCallback((id: string, form: VisitForm) => setState((s) => ({ ...s, visits: s.visits.map((v) => v.id === id ? { ...v, form } : v) })), []);
  const addEvidence = useCallback((id: string, ev: Omit<Evidence, "id">) => setState((s) => ({ ...s, visits: s.visits.map((v) => v.id === id ? { ...v, evidence: [...v.evidence, { ...ev, id: uid() }] } : v) })), []);
  const removeEvidence = useCallback((id: string, evId: string) => setState((s) => ({ ...s, visits: s.visits.map((v) => v.id === id ? { ...v, evidence: v.evidence.filter((e) => e.id !== evId) } : v) })), []);
  const submitVisit = useCallback((id: string) => setState((s) => ({ ...s, visits: s.visits.map((v) => v.id === id ? { ...v, status: "captured" as const, submittedAt: new Date().toISOString(), synced: false } : v), sync: { ...s.sync, pendingUploads: s.sync.pendingUploads + 1 }, activities: [act("visit", "blue", "Visit submitted for review", id), ...s.activities].slice(0, 40) })), []);
  const returnVisit = useCallback((id: string, reason: string) => setState((s) => {
    const visit = s.visits.find((item) => item.id === id);
    if (!visit) throw new Error(`Visit ${id} was not found`);
    return {
      ...s,
      visits: s.visits.map((item) => item.id === id ? { ...item, status: "returned" as const, returnedAt: new Date().toISOString(), returnReason: reason, reviewedAt: new Date().toISOString(), reviewedBy: USERS[s.persona].name } : item),
      cases: s.cases.map((item) => item.id === visit.caseId ? { ...item, verification: "Returned for correction", verificationTone: "warning", readiness: "Review returned", nextAction: "Correct visit and resubmit", updated: "Just now" } : item),
      activities: [act("visit", "coral", "Visit returned", id), ...s.activities].slice(0, 40),
    };
  }), []);
  const approveVisit = useCallback((id: string) => setState((s) => {
    const visit = s.visits.find((item) => item.id === id);
    if (!visit) throw new Error(`Visit ${id} was not found`);
    return {
      ...s,
      visits: s.visits.map((item) => item.id === id ? { ...item, status: "approved" as const, reviewedAt: new Date().toISOString(), reviewedBy: USERS[s.persona].name } : item),
      cases: s.cases.map((item) => {
        if (item.id !== visit.caseId) return item;
        const check = item.verifyNowChecks?.at(-1);
        const verifyPassed = check?.status === "completed" && check.outcome === "match";
        return {
          ...item,
          verification: "Field review approved",
          verificationTone: "success",
          readiness: verifyPassed ? "Ready for department" : "Blocked · VerifyNow required",
          nextAction: verifyPassed ? "Prepare department handoff packet" : "Complete VerifyNow identity check",
          updated: "Just now",
        };
      }),
      activities: [act("visit", "sage", "Visit approved", id), ...s.activities].slice(0, 40),
    };
  }), []);

  const runSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      if (databaseStatusRef.current === "error" || databaseStatusRef.current === "loading") {
        throw new Error(databaseError ?? "Database is not connected");
      }
      manualSyncInProgress.current = true;
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      while (writeInProgress.current) await new Promise((resolve) => window.setTimeout(resolve, 25));
      pendingState.current = null;
      const nextState: StoreState = {
        ...state,
        visits: state.visits.map((visit) => ({
          ...visit,
          synced: visit.status === "captured" ? true : visit.synced,
        })),
        sync: {
          pendingUploads: 0,
          lastSync: new Date().toISOString(),
          runs: state.sync.runs + 1,
        },
        activities: [act("sync", "sage", "Sync complete", "All captured visits saved to the shared database"), ...state.activities].slice(0, 40),
      };
      writeInProgress.current = true;
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: nextState, version: databaseVersion.current }),
      });
      if (response.status === 409) {
        throw new Error("Shared data changed elsewhere. Reload the page to load the latest database state.");
      }
      if (!response.ok) throw new Error(`Could not save to the database (${response.status})`);
      const result = await response.json() as { version: number };
      databaseVersion.current = result.version;
      lastSavedState.current = nextState;
      setState(nextState);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Database sync failed";
      setDatabaseStatus("error", message);
      throw error;
    } finally {
      manualSyncInProgress.current = false;
      writeInProgress.current = false;
      setIsSyncing(false);
    }
  }, [state, databaseError, setDatabaseStatus]);

  const setBlocker = useCallback((caseId: string, blockerId: string, status: Blocker["status"], verb: string) => {
    setState((s) => {
      const list = s.blockers[caseId] ?? [];
      if (!list.find((b) => b.id === blockerId)) return s;
      const updated = list.map((b) => b.id === blockerId ? { ...b, status } : b);
      const open = updated.filter((b) => b.status !== "resolved");
      const cases = s.cases.map((c) => c.id === caseId ? { ...c, readiness: open.length === 0 ? "Ready for works" : `Blocked Â· ${open.length} gate${open.length > 1 ? "s" : ""}`, nextAction: open.length === 0 ? "Confirm builder pack" : open[0].action, updated: "Just now" } : c);
      return { ...s, blockers: { ...s.blockers, [caseId]: updated }, cases, activities: [act("gate", status === "resolved" ? "sage" : "sand", verb, caseId), ...s.activities].slice(0, 40) };
    });
  }, []);
  const requestBlocker = useCallback((c: string, b: string) => setBlocker(c, b, "requested", "Gate requested"), [setBlocker]);
  const assignBlocker = useCallback((c: string, b: string) => setBlocker(c, b, "assigned", "Gate assigned"), [setBlocker]);
  const resolveBlocker = useCallback((c: string, b: string) => setBlocker(c, b, "resolved", "Gate resolved"), [setBlocker]);

  const createIntakeDraft = useCallback((): Intake => {
    let created: Intake | null = null;
    setState((s) => {
      const id = nextIntakeId(s.intakes);
      created = emptyIntake(id, USERS[s.persona].name);
      return { ...s, intakes: [created, ...s.intakes], activities: [act("intake", "sand", "Intake draft started", id), ...s.activities].slice(0, 40) };
    });
    if (!created) created = emptyIntake(nextIntakeId(state.intakes), USERS[state.persona].name);
    return created;
  }, [state.intakes, state.persona]);

  const saveIntake = useCallback((i: Intake) => setState((s) => ({ ...s, intakes: s.intakes.map((x) => x.id === i.id ? i : x) })), []);

  const submitIntake = useCallback((id: string) => setState((s) => ({ ...s, intakes: s.intakes.map((i) => i.id === id ? { ...i, status: "submitted" as const, submittedAt: new Date().toISOString() } : i), activities: [act("intake", "blue", "Intake submitted for review", id), ...s.activities].slice(0, 40) })), []);

  const returnIntake = useCallback((id: string, reason: string) => setState((s) => ({ ...s, intakes: s.intakes.map((i) => i.id === id ? { ...i, status: "returned" as const, returnedAt: new Date().toISOString(), returnReason: reason, reviewedAt: new Date().toISOString(), reviewedBy: USERS[s.persona].name } : i), activities: [act("intake", "coral", "Intake returned", `${id} Â· ${reason.slice(0, 40)}`), ...s.activities].slice(0, 40) })), []);

  const approveIntake = useCallback((id: string): CaseRecord | null => {
    let newCase: CaseRecord | null = null;
    setState((s) => {
      const intake = s.intakes.find((i) => i.id === id);
      if (!intake) return s;
      const year = new Date().getFullYear();
      const maxCase = s.cases.reduce((m, c) => { const n = Number(c.id.split("-")[2]); return Number.isFinite(n) && n > m ? n : m; }, 121);
      const caseId = `AY-${year}-${String(maxCase + 1).padStart(4, "0")}`;
      const surname = intake.applicantSurname.trim();
      const locality = [intake.location.village, intake.location.ward].filter(Boolean).join(" Â· ");
      const sources = intake.programmes.map((p) => ({ listName: p.listName, reference: p.reference, importedAt: new Date().toISOString() }));
      newCase = {
        id: caseId,
        name: `${intake.applicantFirstName} ${intake.applicantSurname}`.trim(),
        household: `${surname} household`,
        project: "Ndlovu Extension Phase 2",
        location: locality || intake.location.municipality,
        source: intake.programmes[0]?.listName ?? "Field intake",
        verification: "Awaiting verification visit",
        verificationTone: "warning",
        subsidy: "Not started", subsidyTone: "neutral",
        readiness: "Not started",
        nextAction: "Complete field verification visit",
        updated: "Just now",
        members: intake.householdMembers.filter((m) => m.fullName.trim()).length || 1,
        site: "Unallocated",
        sources,
        intakeId: intake.id,
      };
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0);
      const maxVisit = s.visits.reduce((m, v) => { const n = Number(v.id.split("-")[2]); return Number.isFinite(n) && n > m ? n : m; }, 1000);
      const visit: Visit = {
        id: `V-${year}-${String(maxVisit + 1).padStart(4, "0")}`,
        caseId, assignedTo: intake.capturedBy,
        scheduledFor: tomorrow.toISOString(),
        status: "assigned", form: null, evidence: [],
        startedAt: null, submittedAt: null, reviewedAt: null, returnedAt: null,
        returnReason: null, reviewedBy: null, synced: false,
      };
      return {
        ...s,
        cases: [newCase, ...s.cases],
        visits: [visit, ...s.visits],
        intakes: s.intakes.map((i) => i.id === id ? { ...i, status: "approved" as const, reviewedAt: new Date().toISOString(), reviewedBy: USERS[s.persona].name, createdCaseId: caseId } : i),
        activities: [act("intake", "sage", "Intake approved", `${id} â†’ ${caseId}`), act("visit", "blue", "Verification visit scheduled", visit.id), ...s.activities].slice(0, 40),
      };
    });
    return newCase;
  }, []);

  const linkIntake = useCallback((id: string, caseId: string, reason: string) => setState((s) => ({ ...s, intakes: s.intakes.map((i) => i.id === id ? { ...i, status: "linked_to_existing" as const, linkedToCaseId: caseId, reviewedAt: new Date().toISOString(), reviewedBy: USERS[s.persona].name, duplicateResolution: "linked" as const, duplicateResolutionReason: reason } : i), activities: [act("intake", "sage", "Intake linked to existing case", `${id} â†’ ${caseId}`), ...s.activities].slice(0, 40) })), []);

  const discardIntake = useCallback((id: string) => setState((s) => ({ ...s, intakes: s.intakes.filter((i) => i.id !== id) })), []);

  const value = useMemo<Ctx>(() => ({
    ...state, currentUser: USERS[state.persona], isOnline, isSyncing,
    databaseStatus, databaseError, retryDatabase,
    setPersona, setSeed, resetDemo,
    startVisit, saveVisitForm, addEvidence, removeEvidence, submitVisit, returnVisit, approveVisit, runSync,
    createCase, updateCaseRecord, archiveCase, restoreCase, assignCases, runVerifyNowChecks, markDepartmentPacketExported,
    requestBlocker, assignBlocker, resolveBlocker,
    createIntakeDraft, saveIntake, submitIntake, approveIntake, returnIntake, linkIntake, discardIntake,
  }), [state, isOnline, isSyncing, databaseStatus, databaseError, retryDatabase, setPersona, setSeed, resetDemo, createCase, updateCaseRecord, archiveCase, restoreCase, assignCases, runVerifyNowChecks, markDepartmentPacketExported, startVisit, saveVisitForm, addEvidence, removeEvidence, submitVisit, returnVisit, approveVisit, runSync, requestBlocker, assignBlocker, resolveBlocker, createIntakeDraft, saveIntake, submitIntake, approveIntake, returnIntake, linkIntake, discardIntake]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore outside StoreProvider");
  return ctx;
}