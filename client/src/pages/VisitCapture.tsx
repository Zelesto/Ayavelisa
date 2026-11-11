import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, CheckCircle2,
  Clock, FileWarning, Hash, Navigation, Plus, Trash2, Upload, X,
} from "lucide-react";
import { navigate } from "@/lib/router";
import { useStore } from "@/lib/store";
import { SectionEyebrow, StatusPill, cx, useToast } from "@/components/ui";
import { captureGps, formatCoord } from "@/lib/geo";
import { compressImage, formatBytes } from "@/lib/photo";
import type {
  AcknowledgementMode, CheckSource, Grievance, HouseholdRelationship, PreferredLanguage,
  PriorAssistanceStatus, ProgrammeCategory, ProofOfResidenceStatus, TenureType,
  VisitEvidenceCategory, VisitForm, VisitHouseholdMember, VisitOutcome,
  VulnerabilityCategory, WitnessDetails,
} from "@/lib/types";
import { useVisitDraft } from "@/lib/useVisitDraft";

// VisitVulnerabilityCategoryCompat = VulnerabilityCategory, re-exported for compat
// (kept in the import list above only if you need it — otherwise remove both.)

// VisitVulnerabilityCategoryCompat = VulnerabilityCategory, re-exported for compat
// (kept in the import list above only if you need it — otherwise remove both.)

const STEPS = [
  "Arrival & location",
  "Identity",
  "Household",
  "Contact & language",
  "Dwelling & tenure",
  "Programme & vulnerability",
  "Prior assistance & proof",
  "Outcome & grievances",
  "Acknowledgement & submit",
] as const;

const READINESS_STEP: Record<string, number> = {
  "Confirm arrival": 0,
  "Worker declaration": 0,
  Village: 0,
  "Identity evidence": 1,
  "Household members": 2,
  "Primary phone": 3,
  "Programme source and reference": 5,
  "Prior assistance check": 6,
  "Visit outcome": 7,
  "Outcome note": 7,
  "Fieldworker name": 8,
  Signature: 8,
  "Witness name": 8,
  "Witness ID": 8,
  "Witness reason": 8,
};

function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }

function blankForm(): VisitForm {
  return {
    schemaVersion: 3,
    arrivalConfirmed: false,
    visitType: "initial",
    gps: null,
    gpsOutsideBoundary: false,
    gpsLowAccuracy: false,
    gpsManualCorrection: false,
    gpsManualReason: "",
    gpsOriginalReading: null,
    arrivalAt: null,
    departedAt: null,
    intervieweeName: "",
    intervieweeRelationship: "head",
    intervieweeIsApplicant: false,
    workerDeclaration: false,
    villageObserved: "",
    wardObserved: "",
    municipalityObserved: "",
    locationSource: "observed",
    locationDiscrepancyNote: "",
    identityType: "South African ID",
    identityNumber: "",
    identityVerified: false,
    identityMatchesRegister: true,
    identitySource: "observed",
    identityNote: "",
    householdMembers: [],
    householdSource: "observed",
    undeclaredPersonsPresent: 0,
    undeclaredPersonsNote: "",
    householdObserved: 0,
    occupancyObservation: "",
    primaryPhone: "",
    primaryPhoneVerified: false,
    primaryPhoneSource: "declared",
    alternatePhone: "",
    preferredLanguage: "English",
    communicationConsent: false,
    dwellingType: "",
    dwellingCondition: "",
    dwellingSource: "observed",
    tenureType: "unknown",
    tenureEvidenceCaptured: false,
    tenureSource: "observed",
    programmeSourceListName: "",
    programmeReference: "",
    programmeSourceConfirmed: false,
    programmeSource: "declared",
    confirmedProgrammeCategory: "unresolved",
    programmeNote: "",
    vulnerabilityCategory: "none",
    vulnerabilityDetail: "",
    vulnerabilityRecordedWithConsent: false,
    requiresReasonableAccommodation: false,
    vulnerabilitySource: "declared",
    priorAssistanceChecked: false,
    priorAssistanceStatus: "unknown",
    priorAssistanceSource: "declared",
    priorAssistanceNote: "",
    proofOfResidenceStatus: "outstanding",
    proofOfResidenceSource: "observed",
    proofOfResidenceNote: "",
    outcome: "verified",
    revisitDate: null,
    outcomeNote: "",
    acknowledgementMode: "signature",
    formVersion: "visit-v3.0",
    acknowledgementLanguage: "English",
    representativeAuthority: null,
    witness: null,
    grievances: [],
    fieldworkerName: "",
    notes: "",
  };
}

function migrate(form: VisitForm | null): VisitForm {
  if (!form) return blankForm();
  const merged: VisitForm = { ...blankForm(), ...form, schemaVersion: 3 };
  if (!merged.householdMembers?.length && (merged.householdObserved ?? 0) > 0) {
    merged.householdMembers = Array.from({ length: merged.householdObserved }, () => ({
      id: uid(),
      declaredMemberId: null,
      fullName: "",
      relationship: "head" as const,
      dateOfBirth: null,
      present: true,
      note: "",
    }));
  }
  return merged;
}

/* ------------------------------------------------------------------ */
/* Small widgets                                                       */
/* ------------------------------------------------------------------ */

function SourcePicker({
  value, onChange, disabled,
}: { value: CheckSource; onChange: (v: CheckSource) => void; disabled: boolean }) {
  const opts: { key: CheckSource; label: string; help: string }[] = [
    { key: "observed", label: "Observed", help: "I saw this on-site" },
    { key: "declared", label: "Declared", help: "Applicant stated it" },
    { key: "externally_confirmed", label: "External", help: "Confirmed by document or source" },
  ];
  return (
    <div className="source-picker" role="radiogroup" aria-label="Evidence source">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          className={cx("source-chip", value === o.key && "is-active", `source-${o.key}`)}
          onClick={() => onChange(o.key)}
          disabled={disabled}
          aria-checked={value === o.key}
          title={o.help}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function VisitCapture({ visitId }: { visitId: string }) {
  const {
    visits, cases, persona, startVisit, saveVisitForm, addEvidence, removeEvidence,
    submitVisit, returnVisit, approveVisit, databaseStatus,
  } = useStore();
  const { notify } = useToast();
  const visit = visits.find((v) => v.id === visitId);
  const cs = visit ? cases.find((c) => c.id === visit.caseId) : undefined;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<VisitForm>(() => migrate(visit?.form ?? blankForm()));
  const { state: saveState, lastSavedAt } = useVisitDraft(visit?.id ?? "", form, saveVisitForm);
  const [editing, setEditing] = useState(false);

  const [gpsBusy, setGpsBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoCategory, setPhotoCategory] = useState<VisitEvidenceCategory>("dwelling");
  const [photoCategoryOther, setPhotoCategoryOther] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [showReturn, setShowReturn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const sigRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    if (!visit) return;
    if (visit.status === "assigned") startVisit(visit.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit?.id]);

  useEffect(() => {
    setForm(migrate(visit?.form ?? blankForm()));
  }, [visit?.id, visit?.form]);

  const observedCount = form.householdMembers.filter((m) => m.present).length;
  const declaredCount = cs?.members ?? 0;
  const variance = observedCount - declaredCount;

  /* ---------- Readiness ---------- */
  const submitReadiness = useMemo(() => {
    const missing: string[] = [];
    if (!form.arrivalConfirmed) missing.push("Confirm arrival");
    if (!form.workerDeclaration) missing.push("Worker declaration");
    if (!form.fieldworkerName.trim()) missing.push("Fieldworker name");
    if (!form.outcome) missing.push("Visit outcome");
    if (form.outcome !== "verified" && !form.outcomeNote.trim()) missing.push("Outcome note");

    if (form.outcome === "verified") {
      if (!form.villageObserved.trim()) missing.push("Village");
      if (!form.identityVerified) missing.push("Identity evidence");
      if (form.householdMembers.filter((m) => m.fullName.trim()).length === 0) {
        missing.push("Household members");
      }
      if (!form.primaryPhone.trim()) missing.push("Primary phone");
      if (!form.programmeSourceListName.trim() || !form.programmeReference.trim()) {
        missing.push("Programme source and reference");
      }
      if (!form.priorAssistanceChecked) missing.push("Prior assistance check");
      if (form.acknowledgementMode === "signature") {
        if (!visit?.evidence.some((e) => e.kind === "signature")) missing.push("Signature");
      } else {
        if (!form.witness?.witnessName?.trim()) missing.push("Witness name");
        if (!form.witness?.witnessIdNumber?.trim()) missing.push("Witness ID");
        if (!form.witness?.reason?.trim()) missing.push("Witness reason");
      }
    }
    return { ok: missing.length === 0, missing };
  }, [form, visit?.evidence]);

  if (!visit) {
    return (
      <div className="missing-state">
        <h2>Visit not found</h2>
        <p>{visitId} is not in your assignment list.</p>
        <button className="button button-primary" type="button" onClick={() => navigate("/field/visits")}>
          Back to My visits
        </button>
      </div>
    );
  }

  const isEditable = (visit.status !== "captured" && visit.status !== "approved") || editing;
  const set = <K extends keyof VisitForm>(k: K, v: VisitForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const persist = (next?: VisitForm) => saveVisitForm(visit.id, next ?? form);

  const gotoStep = (n: number) => {
    persist();
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
  };

  /* ---------- GPS ---------- */
  const grabGps = async () => {
    setGpsBusy(true);
    const g = await captureGps();
    setGpsBusy(false);
    setForm((f) => ({
      ...f,
      gps: g,
      gpsOriginalReading: f.gps ? formatCoord(f.gps) : f.gpsOriginalReading,
      gpsLowAccuracy: g.accuracyM > 30,
      arrivalAt: f.arrivalAt ?? new Date().toISOString(),
    }));
    notify(
      g.source === "device"
        ? `Location captured ±${g.accuracyM} m${g.accuracyM > 30 ? " (low accuracy)" : ""}`
        : "GPS unavailable — record a manual reason",
    );
  };

  /* ---------- Evidence ---------- */
  const readPhoto = async (file: File, category: VisitEvidenceCategory, label: string) => {
    setPhotoBusy(true);
    try {
      const { dataUrl, sizeBytes } = await compressImage(file);
      const hash = await sha256Short(dataUrl);
      addEvidence(visit.id, {
        kind: "photo",
        category,
        label: label || file.name.slice(0, 40),
        dataUrl,
        capturedAt: new Date().toISOString(),
        sizeBytes,
        provenance: {
          deviceRef: navigator.userAgent.slice(0, 80),
          capturedAtDevice: new Date().toISOString(),
          coordinates: form.gps ? { lat: form.gps.lat, lng: form.gps.lng } : null,
          fileHash: hash,
          transformation: "compressed",
        },
        legibilityStatus: "unreviewed",
      });
      notify(`Photo attached (${formatBytes(sizeBytes)})`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not process the photo", "error");
    } finally {
      setPhotoBusy(false);
    }
  };

  /* ---------- Household ---------- */
  const addMember = () => {
    const m: VisitHouseholdMember = {
      id: uid(), declaredMemberId: null, fullName: "",
      relationship: form.householdMembers.length === 0 ? "head" : "child",
      dateOfBirth: null, present: true, note: "",
    };
    set("householdMembers", [...form.householdMembers, m]);
  };
  const updateMember = (mid: string, patch: Partial<VisitHouseholdMember>) =>
    set("householdMembers", form.householdMembers.map((m) => (m.id === mid ? { ...m, ...patch } : m)));
  const removeMember = (mid: string) =>
    set("householdMembers", form.householdMembers.filter((m) => m.id !== mid));

  /* ---------- Signature ---------- */
  const startSig = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = sigRef.current; if (!c) return;
    drawing.current = true;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const r = c.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(((e.clientX - r.left) * c.width) / r.width, ((e.clientY - r.top) * c.height) / r.height);
  };
  const moveSig = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const c = sigRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const r = c.getBoundingClientRect();
    ctx.lineTo(((e.clientX - r.left) * c.width) / r.width, ((e.clientY - r.top) * c.height) / r.height);
    ctx.strokeStyle = "#183331"; ctx.lineWidth = 2; ctx.stroke();
  };
  const endSig = () => { drawing.current = false; };
  const clearSig = () => {
    sigRef.current?.getContext("2d")?.clearRect(0, 0, sigRef.current.width, sigRef.current.height);
  };
  const saveSig = async () => {
    const c = sigRef.current; if (!c) return;
    const dataUrl = c.toDataURL("image/png");
    const sizeBytes = Math.round((dataUrl.length * 3) / 4);
    const hash = await sha256Short(dataUrl);
    addEvidence(visit.id, {
      kind: "signature", label: "Applicant signature",
      dataUrl, capturedAt: new Date().toISOString(), sizeBytes,
      provenance: {
        deviceRef: navigator.userAgent.slice(0, 80),
        capturedAtDevice: new Date().toISOString(),
        coordinates: form.gps ? { lat: form.gps.lat, lng: form.gps.lng } : null,
        fileHash: hash, transformation: null,
      },
    });
    notify(`Signature saved (${formatBytes(sizeBytes)})`);
    clearSig();
  };

  /* ---------- Grievances ---------- */
  const addGrievance = () => {
    const g: Grievance = {
      id: uid(),
      raisedAt: new Date().toISOString(),
      raisedBy: form.intervieweeName || "Applicant",
      description: "",
      category: "other",
      status: "open",
      resolutionOwner: null,
      dueDate: null,
      resolution: null,
      resolvedAt: null,
    };
    set("grievances", [...form.grievances, g]);
  };
  const updateGrievance = (id: string, patch: Partial<Grievance>) =>
    set("grievances", form.grievances.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const removeGrievance = (id: string) =>
    set("grievances", form.grievances.filter((g) => g.id !== id));

  /* ---------- Submit / approve / return ---------- */
  const submit = () => {
    if (submitting) return;
    if (!submitReadiness.ok) {
      const firstMissing = submitReadiness.missing[0];
      setStep(READINESS_STEP[firstMissing] ?? 8);
      notify(`Complete required information: ${submitReadiness.missing.join(", ")}`, "error");
      return;
    }
    setSubmitting(true);
    try {
      persist();
      submitVisit(visit.id);
      notify(databaseStatus === "error"
        ? "Visit submitted on this device. It will be shared with reviewers when the database reconnects."
        : "Visit submitted for review");
      navigate("/field/visits");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not submit visit", "error");
      setSubmitting(false);
    }
  };
  const handleReturn = () => {
    if (returnReason.trim().length < 5) { notify("Enter a reason", "error"); return; }
    try { returnVisit(visit.id, returnReason); notify("Visit returned"); navigate("/review"); }
    catch (e) { notify(e instanceof Error ? e.message : "Could not return visit", "error"); }
  };
  const handleApprove = () => {
    try { approveVisit(visit.id); notify("Visit approved"); navigate("/review"); }
    catch (e) { notify(e instanceof Error ? e.message : "Could not approve visit", "error"); }
  };

  return (
    <div className="visit-capture">
      <button className="back-link" type="button" onClick={() => navigate("/field/visits")}>
        <ArrowLeft size={15} /> Back to My visits
      </button>

      <header className="visit-heading">
        <div className="visit-heading-copy">
          <SectionEyebrow>Field visit · {visit.id}</SectionEyebrow>
          <h1>{cs?.name ?? visit.caseId}</h1>
          <p>{cs?.household ?? visit.caseId}</p>
          <div className="visit-location">{cs?.location ?? "Location not recorded"} <span>·</span> {cs?.project ?? "Household verification"}</div>
        </div>
        <div className="case-heading-actions">
          {(visit.status === "captured" || visit.status === "approved") && (
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                if (editing) {
                  persist();
                  setEditing(false);
                  notify("Visit edits saved");
                } else {
                  setEditing(true);
                }
              }}
            >
              {editing ? "Save edits" : "Edit visit"}
            </button>
          )}
          <div
            className={cx("save-indicator", `save-${saveState}`)}
            role="status"
            aria-live="polite"
          >
            {saveState === "idle" && (
              <>
                ✓ Saved
                {lastSavedAt && ` · ${lastSavedAt.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}`}
              </>
            )}
            {saveState === "saving" && <>↻ Saving…</>}
            {saveState === "error" && <>⚠ Save failed</>}
          </div>
          <StatusPill
            label={visit.status.replaceAll("_", " ")}
            tone={
              visit.status === "returned" ? "danger"
              : visit.status === "approved" ? "success"
              : visit.status === "captured" ? "info"
              : "warning"
            }
          />
        </div>
      </header>

      {visit.status === "returned" && visit.returnReason && (
        <div className="notice-banner" style={{ background: "var(--danger-light)", borderColor: "#e7c0ba" }}>
          <div className="notice-symbol" style={{ background: "#e8c1ba", color: "var(--danger)" }}>
            <AlertTriangle size={16} />
          </div>
          <div><strong>Returned by {visit.reviewedBy}</strong><span>{visit.returnReason}</span></div>
        </div>
      )}

      <div className="visit-workspace">
        <nav className="capture-stepper" aria-label="Visit sections">
          <div className="capture-progress">
            <div><strong>Visit progress</strong><span>Step {step + 1} of {STEPS.length}</span></div>
            <div className="capture-progress-track" aria-hidden="true">
              <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>
          </div>
          {STEPS.map((s, i) => (
            <button
              key={s} type="button"
              className={cx("capture-step", i === step && "is-active", i < step && "is-done")}
              onClick={() => gotoStep(i)}
              disabled={!isEditable && i !== step}
              aria-current={i === step ? "step" : undefined}
            >
              <span className="capture-step-dot">{i < step ? <Check size={12} /> : i + 1}</span>
              <span>{s}</span>
            </button>
          ))}
        </nav>

        <div className="capture-content">
        <div className="capture-body">
        {/* ===================================================== STEP 1 */}
        {step === 0 && (
          <section className="panel capture-panel">
            <SectionEyebrow>Step 1 · Arrival &amp; location</SectionEyebrow>
            <h2>Confirm you are on site</h2>

            <div className="form-grid" style={{ padding: 0 }}>
              <label className="capture-field">
                <span>Visit type</span>
                <select value={form.visitType}
                  onChange={(e) => set("visitType", e.target.value as VisitForm["visitType"])}
                  disabled={!isEditable}>
                  <option value="initial">Initial verification</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="revisit">Revisit</option>
                  <option value="verification">Verification of returned case</option>
                </select>
              </label>
              <label className="capture-field">
                <span>Arrival time</span>
                <input type="datetime-local" value={form.arrivalAt?.slice(0, 16) ?? ""}
                  onChange={(e) => set("arrivalAt", e.target.value ? new Date(e.target.value).toISOString() : null)}
                  disabled={!isEditable} />
              </label>
              <label className="capture-field">
                <span>Departure time</span>
                <input type="datetime-local" value={form.departedAt?.slice(0, 16) ?? ""}
                  onChange={(e) => set("departedAt", e.target.value ? new Date(e.target.value).toISOString() : null)}
                  disabled={!isEditable} />
              </label>
            </div>

            <label className="check-toggle">
              <input type="checkbox" checked={form.arrivalConfirmed}
                onChange={(e) => set("arrivalConfirmed", e.target.checked)}
                disabled={!isEditable} />
              I confirm I am present at the household and ready to capture evidence.
            </label>
            <label className="check-toggle">
              <input type="checkbox" checked={form.workerDeclaration}
                onChange={(e) => set("workerDeclaration", e.target.checked)}
                disabled={!isEditable} />
              I personally visited this household and the information captured is accurate to the best of my knowledge.
            </label>

            <div className="form-grid" style={{ padding: 0, marginTop: 12 }}>
              <label className="capture-field">
                <span>Interviewee name</span>
                <input value={form.intervieweeName}
                  onChange={(e) => set("intervieweeName", e.target.value)}
                  disabled={!isEditable}
                  placeholder="Who did you speak to?" />
              </label>
              <label className="capture-field">
                <span>Interviewee relationship</span>
                <select value={form.intervieweeRelationship}
                  onChange={(e) => set("intervieweeRelationship", e.target.value as HouseholdRelationship | "other")}
                  disabled={!isEditable}>
                  <option value="head">Head of household</option>
                  <option value="spouse">Spouse</option>
                  <option value="partner">Partner</option>
                  <option value="child">Child</option>
                  <option value="parent">Parent</option>
                  <option value="sibling">Sibling</option>
                  <option value="grandchild">Grandchild</option>
                  <option value="other">Other</option>
                </select>
              </label>
              {form.intervieweeRelationship === "other" && (
                <label className="capture-field">
                  <span>Specify relationship</span>
                  <input value={form.intervieweeRelationshipOther ?? ""}
                    onChange={(e) => set("intervieweeRelationshipOther", e.target.value)}
                    disabled={!isEditable}
                    placeholder="Describe the relationship" />
                </label>
              )}
              <label className="check-toggle" style={{ gridColumn: "1 / -1" }}>
                <input type="checkbox" checked={form.intervieweeIsApplicant}
                  onChange={(e) => set("intervieweeIsApplicant", e.target.checked)}
                  disabled={!isEditable} />
                The interviewee is the applicant themselves.
              </label>
            </div>

            <div className="capture-gps-row">
              <div>
                <div className="capture-label">GPS reading</div>
                <div className="capture-gps-value">{formatCoord(form.gps)}</div>
                {form.gpsLowAccuracy && form.gps && (
                  <small className="field-warn"><FileWarning size={12} /> Low accuracy (&gt;30 m) — manual correction recommended</small>
                )}
              </div>
              <button type="button" className="button button-outline" onClick={grabGps} disabled={!isEditable || gpsBusy}>
                <Navigation size={15} /> {gpsBusy ? "Reading…" : form.gps ? "Re-read GPS" : "Capture GPS"}
              </button>
            </div>

            <label className="check-toggle">
              <input type="checkbox" checked={form.gpsOutsideBoundary}
                onChange={(e) => set("gpsOutsideBoundary", e.target.checked)}
                disabled={!isEditable} />
              The captured coordinates fall <strong>outside</strong> the project boundary. (Flag for supervisor; not fraud by default.)
            </label>

            <label className="check-toggle">
              <input type="checkbox" checked={form.gpsManualCorrection}
                onChange={(e) => set("gpsManualCorrection", e.target.checked)}
                disabled={!isEditable} />
              I manually corrected the pin. (Original reading is preserved below.)
            </label>
            {form.gpsManualCorrection && (
              <>
                <div className="capture-note">
                  <Hash size={13} /> Original reading preserved:{" "}
                  <code>{form.gpsOriginalReading ?? "—"}</code>
                </div>
                <label className="capture-field">
                  <span>Reason for manual correction (required)</span>
                  <textarea value={form.gpsManualReason}
                    onChange={(e) => set("gpsManualReason", e.target.value)}
                    disabled={!isEditable}
                    placeholder="e.g. No GPS signal under the roof; used map pin based on erf boundary" />
                </label>
              </>
            )}

            <div className="form-grid" style={{ padding: 0, marginTop: 12 }}>
              <label className="capture-field">
                <span>Village / settlement observed</span>
                <input value={form.villageObserved}
                  onChange={(e) => set("villageObserved", e.target.value)}
                  disabled={!isEditable}
                  placeholder={`Register: ${cs?.location ?? "—"}`} />
              </label>
              <label className="capture-field">
                <span>Ward</span>
                <input value={form.wardObserved}
                  onChange={(e) => set("wardObserved", e.target.value)}
                  disabled={!isEditable} />
              </label>
              <label className="capture-field field-span-2">
                <span>Municipality</span>
                <input value={form.municipalityObserved}
                  onChange={(e) => set("municipalityObserved", e.target.value)}
                  disabled={!isEditable} />
              </label>
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="capture-label">How was this location determined? (VER02)</div>
              <SourcePicker value={form.locationSource} onChange={(v) => set("locationSource", v)} disabled={!isEditable} />
            </div>
            <label className="capture-field" style={{ marginTop: 8 }}>
              <span>Discrepancy note (if register location differs)</span>
              <textarea value={form.locationDiscrepancyNote}
                onChange={(e) => set("locationDiscrepancyNote", e.target.value)}
                disabled={!isEditable} />
            </label>
          </section>
        )}

        {/* ===================================================== STEP 2 */}
        {step === 1 && (
          <section className="panel capture-panel">
            <SectionEyebrow>Step 2 · Identity</SectionEyebrow>
            <h2>Applicant identity evidence</h2>
            <div className="form-grid" style={{ padding: 0 }}>
              <label className="capture-field">
                <span>Document type</span>
                <select value={form.identityType}
                  onChange={(e) => set("identityType", e.target.value)}
                  disabled={!isEditable}>
                  <option>South African ID</option>
                  <option>Passport</option>
                  <option>Refugee permit</option>
                  <option>Asylum seeker permit</option>
                  <option>No document available</option>
                </select>
              </label>
              <label className="capture-field">
                <span>Document number</span>
                <input value={form.identityNumber}
                  onChange={(e) => set("identityNumber", e.target.value)}
                  disabled={!isEditable}
                  placeholder="e.g. 0000000000000" />
              </label>
            </div>
            <label className="check-toggle">
              <input type="checkbox" checked={form.identityVerified}
                onChange={(e) => set("identityVerified", e.target.checked)}
                disabled={!isEditable} />
              I have seen the original document and recorded a legible photograph.
            </label>
            <label className="check-toggle">
              <input type="checkbox" checked={form.identityMatchesRegister}
                onChange={(e) => set("identityMatchesRegister", e.target.checked)}
                disabled={!isEditable} />
              The document matches the identity on the source register.
            </label>
            <label className="capture-field">
              <span>Identity note (optional)</span>
              <textarea value={form.identityNote}
                onChange={(e) => set("identityNote", e.target.value)}
                disabled={!isEditable} />
            </label>
            <div style={{ marginTop: 8 }}>
              <div className="capture-label">Evidence source (VER02)</div>
              <SourcePicker value={form.identitySource} onChange={(v) => set("identitySource", v)} disabled={!isEditable} />
            </div>
            <div className="capture-note">
              <AlertTriangle size={13} /> Format checks are NOT identity verification. The photograph is what reviewers use.
            </div>

            <div className="capture-evidence-row">
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) readPhoto(f, "identity", "Identity document");
                  e.target.value = "";
                }} />
              <button type="button" className="button button-outline"
                onClick={() => fileRef.current?.click()} disabled={!isEditable || photoBusy}>
                <Camera size={15} /> {photoBusy ? "Processing…" : "Capture ID photo"}
              </button>
            </div>
            <EvidenceGrid visitId={visit.id} onRemove={(id) => removeEvidence(visit.id, id)} editable={isEditable} filter="photo" category="identity" />
          </section>
        )}

        {/* ===================================================== STEP 3 */}
        {step === 2 && (
          <section className="panel capture-panel">
            <SectionEyebrow>Step 3 · Household composition</SectionEyebrow>
            <h2>Who is actually living here?</h2>
            <p className="capture-note">
              Register declares <strong>{declaredCount}</strong> member{declaredCount === 1 ? "" : "s"}.
            </p>
            {variance !== 0 && (
              <div className="notice-banner compact" style={{ background: "var(--danger-light)", borderColor: "#e7c0ba" }}>
                <div className="notice-symbol" style={{ background: "#e8c1ba", color: "var(--danger)" }}>
                  <AlertTriangle size={14} />
                </div>
                <div>
                  <strong>Variance: {variance > 0 ? "+" : ""}{variance}</strong>
                  <span>Observed {observedCount} present; register declares {declaredCount}.</span>
                </div>
              </div>
            )}

            <div className="intake-member-list">
              {form.householdMembers.length === 0 && (
                <div className="capture-note" style={{ padding: 12, background: "var(--paper)", borderRadius: 6 }}>
                  No members captured yet. Start with the applicant.
                </div>
              )}
              {form.householdMembers.map((m) => (
                <div key={m.id} className="intake-member-row visit-household-row">
                  <input value={m.fullName}
                    onChange={(e) => updateMember(m.id, { fullName: e.target.value })}
                    placeholder="Full name" aria-label="Full name" disabled={!isEditable} />
                  <select value={m.relationship}
                    onChange={(e) => updateMember(m.id, { relationship: e.target.value as HouseholdRelationship, relationshipOther: e.target.value === "other" ? m.relationshipOther : "" })}
                    aria-label="Relationship" disabled={!isEditable}>
                    <option value="head">Head</option><option value="spouse">Spouse</option><option value="partner">Partner</option>
                    <option value="child">Child</option><option value="parent">Parent</option><option value="sibling">Sibling</option>
                    <option value="grandchild">Grandchild</option><option value="other">Other</option>
                  </select>
                  <input type="date" value={m.dateOfBirth ?? ""}
                    onChange={(e) => updateMember(m.id, { dateOfBirth: e.target.value || null })}
                    aria-label="Date of birth" disabled={!isEditable} />
                  {m.relationship === "other" ? (
                    <input value={m.relationshipOther ?? ""}
                      onChange={(e) => updateMember(m.id, { relationshipOther: e.target.value })}
                      placeholder="Specify relationship" aria-label="Specify relationship" disabled={!isEditable} />
                  ) : <span className="household-empty-cell" aria-hidden="true" />}
                  <label className="check-toggle" style={{ margin: 0 }}>
                    <input type="checkbox" checked={m.present}
                      onChange={(e) => updateMember(m.id, { present: e.target.checked })} disabled={!isEditable} />
                    Present
                  </label>
                  <input value={m.note}
                    onChange={(e) => updateMember(m.id, { note: e.target.value })}
                    placeholder="Note" aria-label="Note" disabled={!isEditable} />
                  <button type="button" className="icon-button small" onClick={() => removeMember(m.id)} aria-label="Remove" disabled={!isEditable}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="button button-outline intake-add-member" onClick={addMember} disabled={!isEditable}>
              <Plus size={14} /> Add household member
            </button>

            <div style={{ marginTop: 12 }}>
              <div className="capture-label">Evidence source (VER02)</div>
              <SourcePicker value={form.householdSource} onChange={(v) => set("householdSource", v)} disabled={!isEditable} />
            </div>

            <div className="form-grid" style={{ padding: 0, marginTop: 16 }}>
              <label className="capture-field">
                <span>Undeclared persons present</span>
                <input type="number" min={0} value={form.undeclaredPersonsPresent}
                  onChange={(e) => set("undeclaredPersonsPresent", Number(e.target.value))}
                  disabled={!isEditable} />
              </label>
              <label className="capture-field field-span-2">
                <span>Undeclared persons note</span>
                <input value={form.undeclaredPersonsNote}
                  onChange={(e) => set("undeclaredPersonsNote", e.target.value)}
                  disabled={!isEditable} />
              </label>
            </div>
          </section>
        )}

        {/* ===================================================== STEP 4 */}
        {step === 3 && (
          <section className="panel capture-panel">
            <SectionEyebrow>Step 4 · Contact &amp; language</SectionEyebrow>
            <h2>How to reach this household</h2>
            <div className="form-grid" style={{ padding: 0 }}>
              <label className="capture-field">
                <span>Primary phone</span>
                <input value={form.primaryPhone}
                  onChange={(e) => set("primaryPhone", e.target.value)}
                  disabled={!isEditable}
                  placeholder="+27 71 000 0000" />
              </label>
              <label className="capture-field">
                <span>Alternate phone</span>
                <input value={form.alternatePhone}
                  onChange={(e) => set("alternatePhone", e.target.value)}
                  disabled={!isEditable} />
              </label>
              <label className="capture-field">
                <span>Preferred language</span>
                <select value={form.preferredLanguage}
                  onChange={(e) => { set("preferredLanguage", e.target.value as PreferredLanguage); if (e.target.value !== "Other") set("preferredLanguageOther", ""); }}
                  disabled={!isEditable}>
                  <option>English</option><option>isiXhosa</option><option>isiZulu</option>
                  <option>Sesotho</option><option>Afrikaans</option><option>Other</option>
                </select>
              </label>
              {form.preferredLanguage === "Other" && (
                <label className="capture-field">
                  <span>Specify preferred language</span>
                  <input value={form.preferredLanguageOther ?? ""}
                    onChange={(e) => set("preferredLanguageOther", e.target.value)}
                    disabled={!isEditable} />
                </label>
              )}
            </div>
            <label className="check-toggle">
              <input type="checkbox" checked={form.primaryPhoneVerified}
                onChange={(e) => set("primaryPhoneVerified", e.target.checked)}
                disabled={!isEditable} />
              I called this number on-site and it rings / is answered.
            </label>
            <label className="check-toggle">
              <input type="checkbox" checked={form.communicationConsent}
                onChange={(e) => set("communicationConsent", e.target.checked)}
                disabled={!isEditable} />
              Applicant consents to SMS / WhatsApp reminders (optional — refusal does not block the case).
            </label>
            <div style={{ marginTop: 8 }}>
              <div className="capture-label">Phone evidence source (VER02)</div>
              <SourcePicker value={form.primaryPhoneSource} onChange={(v) => set("primaryPhoneSource", v)} disabled={!isEditable} />
            </div>
          </section>
        )}

        {/* ===================================================== STEP 5 */}
        {step === 4 && (
          <section className="panel capture-panel">
            <SectionEyebrow>Step 5 · Dwelling &amp; tenure</SectionEyebrow>
            <h2>What is the household living in now?</h2>
            <div className="form-grid" style={{ padding: 0 }}>
              <label className="capture-field field-span-2">
                <span>Dwelling type</span>
                <input value={form.dwellingType}
                  onChange={(e) => set("dwellingType", e.target.value)}
                  disabled={!isEditable}
                  placeholder="e.g. Informal structure · 2 rooms · no services" />
              </label>
              <label className="capture-field">
                <span>Tenure type</span>
                <select value={form.tenureType}
                  onChange={(e) => set("tenureType", e.target.value as TenureType)}
                  disabled={!isEditable}>
                  <option value="communal">Communal land</option>
                  <option value="municipal">Municipal land</option>
                  <option value="state">State land</option>
                  <option value="farm">Farm</option>
                  <option value="private">Private</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>
            </div>
            <label className="check-toggle">
              <input type="checkbox" checked={form.tenureEvidenceCaptured}
                onChange={(e) => set("tenureEvidenceCaptured", e.target.checked)}
                disabled={!isEditable} />
              Tenure evidence captured (permission letter, tribal authority confirmation, etc.).
            </label>
            <label className="capture-field" style={{ marginTop: 12 }}>
              <span>Dwelling condition</span>
              <textarea value={form.dwellingCondition}
                onChange={(e) => set("dwellingCondition", e.target.value)}
                disabled={!isEditable}
                placeholder="Structure type, roof, walls, services, visible defects…" />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
              <div>
                <div className="capture-label">Dwelling source</div>
                <SourcePicker value={form.dwellingSource} onChange={(v) => set("dwellingSource", v)} disabled={!isEditable} />
              </div>
              <div>
                <div className="capture-label">Tenure source</div>
                <SourcePicker value={form.tenureSource} onChange={(v) => set("tenureSource", v)} disabled={!isEditable} />
              </div>
            </div>
          </section>
        )}

        {/* ===================================================== STEP 6 */}
        {step === 5 && (
          <section className="panel capture-panel">
            <SectionEyebrow>Step 6 · Programme &amp; vulnerability</SectionEyebrow>
            <h2>Source and needs</h2>
            <div className="form-grid" style={{ padding: 0 }}>
              <label className="capture-field">
                <span>Source list name</span>
                <input value={form.programmeSourceListName}
                  onChange={(e) => set("programmeSourceListName", e.target.value)}
                  disabled={!isEditable}
                  placeholder={`Register: ${cs?.source ?? "unknown"}`} />
              </label>
              <label className="capture-field">
                <span>Reference on source list</span>
                <input value={form.programmeReference}
                  onChange={(e) => set("programmeReference", e.target.value)}
                  disabled={!isEditable}
                  placeholder="e.g. DR-2026-0044" />
              </label>
              <label className="capture-field">
                <span>Confirmed programme category</span>
                <select value={form.confirmedProgrammeCategory}
                  onChange={(e) => set("confirmedProgrammeCategory", e.target.value as ProgrammeCategory)}
                  disabled={!isEditable}>
                  <option value="unresolved">Unresolved — needs ECDHS determination</option>
                  <option value="conventional">Conventional</option>
                  <option value="rural">Rural</option>
                  <option value="disaster">Disaster</option>
                  <option value="destitute">Destitute</option>
                  <option value="vulnerable">Vulnerable</option>
                </select>
              </label>
            </div>
            <label className="check-toggle">
              <input type="checkbox" checked={form.programmeSourceConfirmed}
                onChange={(e) => set("programmeSourceConfirmed", e.target.checked)}
                disabled={!isEditable} />
              I confirm the household matches this source list and reference.
            </label>
            <label className="capture-field">
              <span>Programme note</span>
              <textarea value={form.programmeNote}
                onChange={(e) => set("programmeNote", e.target.value)}
                disabled={!isEditable}
                placeholder="e.g. Appears on both Disaster and Destitute lists" />
            </label>
            <div style={{ marginTop: 8 }}>
              <div className="capture-label">Programme source evidence (VER02)</div>
              <SourcePicker value={form.programmeSource} onChange={(v) => set("programmeSource", v)} disabled={!isEditable} />
            </div>

            <div style={{ marginTop: 16 }}>
              <div className="capture-label">Vulnerability (sensitive · SEC01)</div>
              <div className="form-grid" style={{ padding: 0 }}>
                <label className="capture-field">
                  <span>Category</span>
                  <select value={form.vulnerabilityCategory}
                    onChange={(e) => set("vulnerabilityCategory", e.target.value as VulnerabilityCategory)}
                    disabled={!isEditable}>
                    <option value="none">None recorded</option>
                    <option value="elderly">Elderly</option>
                    <option value="disability">Disability</option>
                    <option value="child_headed">Child-headed</option>
                    <option value="chronic_illness">Chronic illness</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="capture-field field-span-2">
                  <span>{form.vulnerabilityCategory === "other" ? "Specify vulnerability" : "Detail"}</span>
                  <input value={form.vulnerabilityDetail}
                    onChange={(e) => set("vulnerabilityDetail", e.target.value)}
                    disabled={!isEditable}
                    placeholder={form.vulnerabilityCategory === "other" ? "Describe the vulnerability" : undefined} />
                </label>
              </div>
              <label className="check-toggle">
                <input type="checkbox" checked={form.requiresReasonableAccommodation}
                  onChange={(e) => set("requiresReasonableAccommodation", e.target.checked)}
                  disabled={!isEditable} />
                Household requires reasonable accommodation (accessibility, mobility).
              </label>
              <label className="check-toggle">
                <input type="checkbox" checked={form.vulnerabilityRecordedWithConsent}
                  onChange={(e) => set("vulnerabilityRecordedWithConsent", e.target.checked)}
                  disabled={!isEditable} />
                Applicant consented to this sensitive information being recorded.
              </label>
              <div style={{ marginTop: 8 }}>
                <div className="capture-label">Vulnerability evidence (VER02)</div>
                <SourcePicker value={form.vulnerabilitySource} onChange={(v) => set("vulnerabilitySource", v)} disabled={!isEditable} />
              </div>
            </div>
          </section>
        )}

        {/* ===================================================== STEP 7 */}
        {step === 6 && (
          <section className="panel capture-panel">
            <SectionEyebrow>Step 7 · Prior assistance &amp; proof of residence</SectionEyebrow>
            <h2>Subsidy-critical evidence (SUB01)</h2>

            <label className="check-toggle">
              <input type="checkbox" checked={form.priorAssistanceChecked}
                onChange={(e) => set("priorAssistanceChecked", e.target.checked)}
                disabled={!isEditable} />
              I have checked whether this household received housing assistance before.
            </label>
            <div className="form-grid" style={{ padding: 0 }}>
              <label className="capture-field">
                <span>Prior assistance result</span>
                <select value={form.priorAssistanceStatus}
                  onChange={(e) => set("priorAssistanceStatus", e.target.value as PriorAssistanceStatus)}
                  disabled={!isEditable || !form.priorAssistanceChecked}>
                  <option value="unknown">Unknown</option>
                  <option value="none">None found</option>
                  <option value="previous_rdp">Previous RDP house</option>
                  <option value="previous_subsidy">Previous subsidy</option>
                </select>
              </label>
              <label className="capture-field field-span-2">
                <span>Prior assistance note (source of evidence)</span>
                <input value={form.priorAssistanceNote}
                  onChange={(e) => set("priorAssistanceNote", e.target.value)}
                  disabled={!isEditable || !form.priorAssistanceChecked} />
              </label>
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="capture-label">Prior assistance evidence (VER02)</div>
              <SourcePicker value={form.priorAssistanceSource} onChange={(v) => set("priorAssistanceSource", v)} disabled={!isEditable} />
            </div>

            <div style={{ marginTop: 16 }}>
              <div className="capture-label">Proof of residence</div>
              <div className="form-grid" style={{ padding: 0 }}>
                <label className="capture-field">
                  <span>Status</span>
                  <select value={form.proofOfResidenceStatus}
                    onChange={(e) => set("proofOfResidenceStatus", e.target.value as ProofOfResidenceStatus)}
                    disabled={!isEditable}>
                    <option value="outstanding">Outstanding — follow-up required</option>
                    <option value="captured">Captured on-site</option>
                    <option value="not_required">Not required</option>
                  </select>
                </label>
                <label className="capture-field field-span-2">
                  <span>Note</span>
                  <input value={form.proofOfResidenceNote}
                    onChange={(e) => set("proofOfResidenceNote", e.target.value)}
                    disabled={!isEditable} />
                </label>
              </div>
              <div style={{ marginTop: 8 }}>
                <div className="capture-label">PoR evidence source</div>
                <SourcePicker value={form.proofOfResidenceSource} onChange={(v) => set("proofOfResidenceSource", v)} disabled={!isEditable} />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div className="capture-label">Supporting evidence</div>
              <div className="capture-evidence-row">
                <select value={photoCategory}
                  onChange={(e) => setPhotoCategory(e.target.value as VisitEvidenceCategory)}
                  disabled={!isEditable}
                  style={{ padding: 6, fontSize: 11, border: "1px solid var(--line)", borderRadius: 6, background: "var(--paper)" }}>
                  <option value="proof_of_residence">Proof of residence</option>
                  <option value="income_evidence">Income evidence</option>
                  <option value="prior_benefit_check">Prior benefit check</option>
                  <option value="property_check">Property check</option>
                  <option value="tenure_evidence">Tenure evidence</option>
                  <option value="dwelling">Dwelling condition</option>
                  <option value="other">Other</option>
                </select>
                {photoCategory === "other" && (
                  <input
                    value={photoCategoryOther}
                    onChange={(e) => setPhotoCategoryOther(e.target.value)}
                    disabled={!isEditable}
                    aria-label="Describe other evidence"
                    placeholder="Describe evidence"
                  />
                )}
                <button type="button" className="button button-outline"
                  onClick={() => fileRef.current?.click()} disabled={!isEditable || photoBusy || (photoCategory === "other" && !photoCategoryOther.trim())}>
                  <Camera size={15} /> {photoBusy ? "Processing…" : "Capture evidence"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readPhoto(f, photoCategory, photoCategory === "other" ? `${photoCategoryOther.trim()} · ${f.name}` : f.name);
                    e.target.value = "";
                  }} />
              </div>
              <EvidenceGrid visitId={visit.id} onRemove={(id) => removeEvidence(visit.id, id)} editable={isEditable} filter="photo" />
            </div>
          </section>
        )}

        {/* ===================================================== STEP 8 */}
        {step === 7 && (
          <section className="panel capture-panel">
            <SectionEyebrow>Step 8 · Outcome &amp; grievances</SectionEyebrow>
            <h2>How did the visit end? (VER01 · VER05)</h2>

            <div className="form-grid" style={{ padding: 0 }}>
              <label className="capture-field">
                <span>Visit outcome</span>
                <select value={form.outcome}
                  onChange={(e) => set("outcome", e.target.value as VisitOutcome)}
                  disabled={!isEditable}>
                  <option value="verified">Verified — all checks completed</option>
                  <option value="partial">Partial — needs follow-up visit</option>
                  <option value="absence">Absence — household not home</option>
                  <option value="refused">Refused to participate</option>
                  <option value="unresolved">Unresolved — needs escalation</option>
                  <option value="withdrawn">Withdrawn by household</option>
                </select>
              </label>
              {form.outcome !== "verified" && (
                <label className="capture-field">
                  <span>Revisit date (if scheduled)</span>
                  <input type="date" value={form.revisitDate ?? ""}
                    onChange={(e) => set("revisitDate", e.target.value || null)}
                    disabled={!isEditable} />
                </label>
              )}
            </div>

            {form.outcome !== "verified" && (
              <label className="capture-field">
                <span>Outcome note (required for non-verified outcomes)</span>
                <textarea value={form.outcomeNote}
                  onChange={(e) => set("outcomeNote", e.target.value)}
                  disabled={!isEditable}
                  placeholder="e.g. Household present but applicant away; adult son confirmed details; revisit Friday" />
              </label>
            )}

            <div style={{ marginTop: 20 }}>
              <div className="capture-label">Grievances / disputes raised during the visit</div>
              {form.grievances.length === 0 && (
                <div className="capture-note" style={{ padding: 12, background: "var(--paper)", borderRadius: 6 }}>
                  No grievances recorded. Add one if the household disputed their identity, programme category, or prior allocation.
                </div>
              )}
              {form.grievances.map((g) => (
                <div key={g.id} style={{ marginTop: 10, padding: 12, background: "var(--paper)", borderRadius: 6, display: "grid", gap: 8 }}>
                  <div className="form-grid" style={{ padding: 0 }}>
                    <label className="capture-field">
                      <span>Category</span>
                      <select value={g.category}
                        onChange={(e) => updateGrievance(g.id, { category: e.target.value as Grievance["category"] })}
                        disabled={!isEditable}>
                        <option value="identity">Identity</option>
                        <option value="category">Programme category</option>
                        <option value="allocation">Prior allocation</option>
                        <option value="evidence">Evidence dispute</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    {g.category === "other" && (
                      <label className="capture-field">
                        <span>Specify category</span>
                        <input value={g.categoryOther ?? ""}
                          onChange={(e) => updateGrievance(g.id, { categoryOther: e.target.value })}
                          disabled={!isEditable} />
                      </label>
                    )}
                    <label className="capture-field">
                      <span>Resolution owner</span>
                      <input value={g.resolutionOwner ?? ""}
                        onChange={(e) => updateGrievance(g.id, { resolutionOwner: e.target.value || null })}
                        disabled={!isEditable}
                        placeholder="e.g. Supervisor Ndlovu" />
                    </label>
                    <label className="capture-field">
                      <span>Due date</span>
                      <input type="date" value={g.dueDate ?? ""}
                        onChange={(e) => updateGrievance(g.id, { dueDate: e.target.value || null })}
                        disabled={!isEditable} />
                    </label>
                  </div>
                  <label className="capture-field">
                    <span>Description</span>
                    <textarea value={g.description}
                      onChange={(e) => updateGrievance(g.id, { description: e.target.value })}
                      disabled={!isEditable}
                      placeholder="What did the household dispute, and what evidence did they offer?" />
                  </label>
                  <button type="button" className="text-button" onClick={() => removeGrievance(g.id)} disabled={!isEditable}>
                    <Trash2 size={13} /> Remove grievance
                  </button>
                </div>
              ))}
              <button type="button" className="button button-outline" onClick={addGrievance} disabled={!isEditable} style={{ marginTop: 8 }}>
                <Plus size={14} /> Record grievance
              </button>
            </div>
          </section>
        )}

        {/* ===================================================== STEP 9 */}
        {step === 8 && (
          <section className="panel capture-panel">
            <SectionEyebrow>Step 9 · Acknowledgement &amp; submit</SectionEyebrow>
            <h2>Applicant acknowledgement (VER04)</h2>

            {!submitReadiness.ok && (
              <div className="notice-banner compact" style={{ background: "var(--danger-light)", borderColor: "#e7c0ba" }}>
                <div className="notice-symbol" style={{ background: "#e8c1ba", color: "var(--danger)" }}>
                  <AlertTriangle size={14} />
                </div>
                <div>
                  <strong>Incomplete — {submitReadiness.missing.length} outstanding</strong>
                  <span>{submitReadiness.missing.join(" · ")}</span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setStep(READINESS_STEP[submitReadiness.missing[0]] ?? 8)}
                  >
                    Go to first required item
                  </button>
                </div>
              </div>
            )}

            <div className="form-grid" style={{ padding: 0 }}>
              <label className="capture-field">
                <span>Form version</span>
                <input value={form.formVersion} disabled readOnly />
              </label>
              <label className="capture-field">
                <span>Language of acknowledgement</span>
                <select value={form.acknowledgementLanguage}
                  onChange={(e) => { set("acknowledgementLanguage", e.target.value as PreferredLanguage); if (e.target.value !== "Other") set("acknowledgementLanguageOther", ""); }}
                  disabled={!isEditable}>
                  <option>English</option><option>isiXhosa</option><option>isiZulu</option>
                  <option>Sesotho</option><option>Afrikaans</option><option>Other</option>
                </select>
              </label>
              {form.acknowledgementLanguage === "Other" && (
                <label className="capture-field">
                  <span>Specify acknowledgement language</span>
                  <input value={form.acknowledgementLanguageOther ?? ""}
                    onChange={(e) => set("acknowledgementLanguageOther", e.target.value)}
                    disabled={!isEditable} />
                </label>
              )}
              <label className="capture-field field-span-2">
                <span>Representative authority (if someone signs on behalf of the applicant)</span>
                <input value={form.representativeAuthority ?? ""}
                  onChange={(e) => set("representativeAuthority", e.target.value || null)}
                  disabled={!isEditable}
                  placeholder="e.g. Son, with verbal authority — witnessed below" />
              </label>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="capture-label">Acknowledgement mode</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {(["signature", "witnessed_alternative"] as AcknowledgementMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={cx("source-chip", form.acknowledgementMode === m && "is-active")}
                    onClick={() => set("acknowledgementMode", m)}
                    disabled={!isEditable}
                    aria-pressed={form.acknowledgementMode === m}
                  >
                    {m === "signature" ? "Signature" : "Witnessed alternative"}
                  </button>
                ))}
              </div>
            </div>

            {form.acknowledgementMode === "signature" ? (
              isEditable && (
                <>
                  <div className="capture-signature-wrap">
                    <canvas ref={sigRef} width={560} height={180} className="capture-signature"
                      onPointerDown={startSig} onPointerMove={moveSig} onPointerUp={endSig} onPointerLeave={endSig} />
                    <div className="capture-signature-actions">
                      <button type="button" className="text-button" onClick={clearSig}>Clear</button>
                      <button type="button" className="button button-primary" onClick={saveSig}>
                        <Check size={14} /> Save signature
                      </button>
                    </div>
                  </div>
                </>
              )
            ) : (
              <div className="form-grid" style={{ padding: 0 }}>
                <label className="capture-field">
                  <span>Witness name</span>
                  <input value={form.witness?.witnessName ?? ""}
                    onChange={(e) => set("witness", {
                      witnessName: e.target.value,
                      witnessIdNumber: form.witness?.witnessIdNumber ?? "",
                      witnessRelationship: form.witness?.witnessRelationship ?? "",
                      reason: form.witness?.reason ?? "",
                    })}
                    disabled={!isEditable} />
                </label>
                <label className="capture-field">
                  <span>Witness ID number</span>
                  <input value={form.witness?.witnessIdNumber ?? ""}
                    onChange={(e) => set("witness", {
                      witnessName: form.witness?.witnessName ?? "",
                      witnessIdNumber: e.target.value,
                      witnessRelationship: form.witness?.witnessRelationship ?? "",
                      reason: form.witness?.reason ?? "",
                    })}
                    disabled={!isEditable} />
                </label>
                <label className="capture-field">
                  <span>Witness relationship</span>
                  <input value={form.witness?.witnessRelationship ?? ""}
                    onChange={(e) => set("witness", {
                      witnessName: form.witness?.witnessName ?? "",
                      witnessIdNumber: form.witness?.witnessIdNumber ?? "",
                      witnessRelationship: e.target.value,
                      reason: form.witness?.reason ?? "",
                    })}
                    disabled={!isEditable}
                    placeholder="e.g. Neighbour, councillor" />
                </label>
                <label className="capture-field field-span-2">
                  <span>Why could the applicant not sign?</span>
                  <textarea value={form.witness?.reason ?? ""}
                    onChange={(e) => set("witness", {
                      witnessName: form.witness?.witnessName ?? "",
                      witnessIdNumber: form.witness?.witnessIdNumber ?? "",
                      witnessRelationship: form.witness?.witnessRelationship ?? "",
                      reason: e.target.value,
                    })}
                    disabled={!isEditable} />
                </label>
              </div>
            )}

            <EvidenceGrid visitId={visit.id} onRemove={(id) => removeEvidence(visit.id, id)} editable={isEditable} filter="signature" />

            <div style={{ marginTop: 16 }}>
              <div className="capture-label">Readiness summary</div>
              <div className="capture-summary">
                <div><CheckCircle2 size={14} className={form.arrivalConfirmed ? "doc-ok" : "doc-warn"} /> Arrival</div>
                <div><CheckCircle2 size={14} className={form.workerDeclaration ? "doc-ok" : "doc-warn"} /> Declaration</div>
                <div><CheckCircle2 size={14} className={form.identityVerified ? "doc-ok" : "doc-warn"} /> Identity</div>
                <div><CheckCircle2 size={14} className={form.householdMembers.length > 0 ? "doc-ok" : "doc-warn"} /> Household</div>
                <div><CheckCircle2 size={14} className={form.primaryPhone.trim() ? "doc-ok" : "doc-warn"} /> Contact</div>
                <div><CheckCircle2 size={14} className={form.programmeSourceConfirmed ? "doc-ok" : "doc-warn"} /> Source</div>
                <div><CheckCircle2 size={14} className={form.priorAssistanceChecked ? "doc-ok" : "doc-warn"} /> Prior</div>
                <div><CheckCircle2 size={14} className={form.outcome ? "doc-ok" : "doc-warn"} /> Outcome</div>
              </div>
            </div>

            <label className="capture-field" style={{ marginTop: 12 }}>
              <span>Fieldworker name</span>
              <input value={form.fieldworkerName}
                onChange={(e) => set("fieldworkerName", e.target.value)}
                disabled={!isEditable}
                placeholder="Your full name as on record" />
            </label>
            <label className="capture-field">
              <span>Visit notes</span>
              <textarea value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                disabled={!isEditable} />
            </label>

            {persona === "fieldworker" && isEditable && (
              <div className="capture-submit-row">
                <button type="button" className="button button-quiet"
                  onClick={() => { persist(); notify("Draft saved on this device"); }}
                  disabled={submitting}>
                  <Upload size={14} /> Save draft
                </button>
                <button type="button" className="button button-primary"
                  onClick={submit} disabled={submitting}>
                  <Check size={15} /> {submitting ? "Submitting…" : submitReadiness.ok ? "Submit for review" : `Complete ${submitReadiness.missing.length} required items`}
                </button>
              </div>
            )}

            {persona !== "fieldworker" && visit.status === "captured" && (
              <div className="capture-submit-row">
                {showReturn ? (
                  <>
                    <input className="capture-return-reason" value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="Reason for return (visible to fieldworker)"
                      aria-label="Reason for return" />
                    <button type="button" className="button button-quiet"
                      onClick={() => { setShowReturn(false); setReturnReason(""); }}>
                      Cancel
                    </button>
                    <button type="button" className="button button-primary" onClick={handleReturn}>
                      Confirm return
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="button button-quiet" onClick={() => setShowReturn(true)}>
                      <AlertTriangle size={14} /> Return with reason
                    </button>
                    <button type="button" className="button button-primary" onClick={handleApprove}>
                      <CheckCircle2 size={15} /> Approve visit
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      <div className="capture-nav">
        <button type="button" className="button button-quiet" onClick={() => gotoStep(step - 1)} disabled={step === 0}>
          <ArrowLeft size={14} /> Previous
        </button>
        <span className="capture-nav-label">Step {step + 1} of {STEPS.length}</span>
        <button type="button" className="button button-quiet" onClick={() => gotoStep(step + 1)} disabled={step === STEPS.length - 1}>
          Next <ArrowRight size={14} />
        </button>
      </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Evidence grid with provenance + legibility review                   */
/* ------------------------------------------------------------------ */

function EvidenceGrid({
  visitId, onRemove, editable, filter, category,
}: {
  visitId: string;
  onRemove: (id: string) => void;
  editable: boolean;
  filter: "photo" | "signature";
  category?: VisitEvidenceCategory;
}) {
  const { visits } = useStore();
  const v = visits.find((x) => x.id === visitId);
  const ev = (v?.evidence ?? []).filter(
    (e) => e.kind === filter && (category ? e.category === category : true),
  );
  if (ev.length === 0) return null;
  return (
    <div className="evidence-grid">
      {ev.map((e) => (
        <div className="evidence-card" key={e.id}>
          {e.kind === "photo" || e.kind === "signature" ? (
            <img src={e.dataUrl} alt={e.label} />
          ) : (
            <div className="evidence-placeholder">{e.label}</div>
          )}
          <div className="evidence-meta">
            <strong>{e.label}</strong>
            <span>
              {e.category ?? e.kind} · {new Date(e.capturedAt).toLocaleTimeString()} · {formatBytes(e.sizeBytes)}
            </span>
            {e.provenance?.fileHash && (
              <small style={{ fontSize: 9, opacity: 0.7 }}>
                <Hash size={10} /> {e.provenance.fileHash.slice(0, 12)}…
              </small>
            )}
            {e.legibilityStatus === "unreadable" && (
              <small className="field-warn" style={{ fontSize: 9 }}>
                <FileWarning size={10} /> Marked unreadable — re-capture needed
              </small>
            )}
          </div>
          {editable && (
            <button type="button" className="icon-button small" onClick={() => onRemove(e.id)} aria-label="Remove">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hash helper (short SHA-256 via SubtleCrypto)                        */
/* ------------------------------------------------------------------ */

async function sha256Short(input: string): Promise<string | null> {
  try {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  } catch {
    return null;
  }
}