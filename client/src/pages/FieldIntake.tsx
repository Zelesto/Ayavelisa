import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, Clock, IdCard,
  MapPin, Navigation, Plus, Save, Trash2, Users, X,
} from "lucide-react";
import { navigate } from "@/lib/router";
import { useStore } from "@/lib/store";
import { SectionEyebrow, StatusPill, cx, useToast } from "@/components/ui";
import { captureGps, formatCoord } from "@/lib/geo";
import { compressImage, formatBytes } from "@/lib/photo";
import { checkSaIdFormat, findDuplicateMatches, intakeReadyForSubmit } from "@/lib/intake";
import type {
  HouseholdMember, HouseholdRelationship, IdDocumentType, Intake, IntakeDocumentCategory,
  PreferredLanguage, ProgrammeCategory, ProgrammeSource, TenureType, VulnerabilityCategory,
} from "@/lib/types";

const STEPS = [
  "Duplicate check", "Identity", "Household", "Contact", "Location",
  "Programme & needs", "Privacy & acknowledgement", "Review & submit",
] as const;

function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }

export default function FieldIntake({ intakeId }: { intakeId?: string }) {
  const store = useStore();
  const { intakes, cases, currentUser, createIntakeDraft, saveIntake, submitIntake, discardIntake, isOnline } = store;
  const { notify } = useToast();

  const [id, setId] = useState<string | null>(intakeId ?? null);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Intake | null>(null);
  const sigRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoCategory, setPhotoCategory] = useState<IntakeDocumentCategory>("other");
  const [photoCategoryOther, setPhotoCategoryOther] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);

  // Load or create the draft exactly once
  useEffect(() => {
    if (draft) return;
    if (id) {
      const existing = intakes.find((x) => x.id === id);
      if (existing) { setDraft(existing); return; }
      notify(`Intake ${id} not found`, "error");
      navigate("/field");
      return;
    }
    const created = createIntakeDraft();
    setId(created.id);
    setDraft(created);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave on any change
  useEffect(() => { if (draft) saveIntake(draft); }, [draft, saveIntake]);

  // Reset supporting-doc category when arriving at the Privacy step so it
  // doesn't silently carry over the "identity" default from step 2.
  useEffect(() => {
    if (step === 6) setPhotoCategory("other");
  }, [step]);

  const set = <K extends keyof Intake>(k: K, v: Intake[K]) => setDraft((d) => d ? { ...d, [k]: v } : d);

  const liveMatches = useMemo(() => {
    if (!draft) return [];
    return findDuplicateMatches(
      {
        firstName: draft.applicantFirstName,
        surname: draft.applicantSurname,
        idNumber: draft.idNumber,
        phone: draft.contact.primaryPhone,
        location: draft.location.village,
      },
      cases,
    );
  }, [draft?.applicantFirstName, draft?.applicantSurname, draft?.idNumber, draft?.contact.primaryPhone, draft?.location.village, cases]);

  useEffect(() => {
    if (!draft) return;
    if (liveMatches.length > 0 && !draft.duplicateSearchPerformed) {
      setDraft((d) => d ? { ...d, duplicateSearchPerformed: true, duplicateMatches: liveMatches } : d);
    } else if (liveMatches.length === 0 && draft.duplicateSearchPerformed && draft.duplicateMatches.length > 0) {
      setDraft((d) => d ? { ...d, duplicateMatches: [] } : d);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMatches]);

  if (!draft) return <div className="missing-state"><p>Loading intake…</p></div>;

  const readiness = intakeReadyForSubmit(draft);
  const memberCount = draft.householdMembers.filter((m) => m.fullName.trim()).length;

  const canLeaveStep = (n: number): boolean => {
    if (n === 0) {
      if (!draft.applicantFirstName.trim() || !draft.applicantSurname.trim()) return false;
      if (draft.duplicateMatches.length > 0 && !draft.duplicateResolution) return false;
      return true;
    }
    if (n === 1) {
      if (draft.idDocumentType !== "none" && !draft.idNumber.trim()) return false;
      if (draft.idDocumentType === "none" && !draft.idFormatReason.trim()) return false;
      return true;
    }
    if (n === 2) return memberCount > 0;
    if (n === 3) return !!draft.contact.primaryPhone.trim();
    if (n === 4) return !!draft.location.village.trim();
    if (n === 5) return draft.programmes.length > 0;
    if (n === 6) return !!draft.privacy;
    return true;
  };

  const next = () => {
    if (!canLeaveStep(step)) { notify("Complete the required fields on this step first", "error"); return; }
    saveIntake(draft);
    setStep(Math.min(STEPS.length - 1, step + 1));
  };
  const prev = () => setStep(Math.max(0, step - 1));

  const checkId = () => {
    if (draft.idDocumentType !== "sa_id") {
      set("idFormatStatus", "format_valid");
      set("idFormatReason", "Non-SA document — format not auto-checked");
      return;
    }
    const r = checkSaIdFormat(draft.idNumber);
    set("idFormatStatus", r.status);
    set("idFormatReason", r.reason);
  };

  const grabGps = async () => {
    const g = await captureGps();
    setDraft((d) => d ? { ...d, location: { ...d.location, gps: g } } : d);
    notify(g.source === "device" ? `Location captured ±${g.accuracyM} m` : "GPS unavailable — record a reason in manual override");
  };

  const addMember = () => {
    const m: HouseholdMember = {
      id: uid(),
      fullName: "",
      relationship: draft.householdMembers.length === 0 ? "head" : "child",
      dateOfBirth: null,
      idNumber: null,
      dependency: "unknown",
      isMinor: false,
      note: null,
    };
    set("householdMembers", [...draft.householdMembers, m]);
  };
  const updateMember = (mid: string, patch: Partial<HouseholdMember>) =>
    set("householdMembers", draft.householdMembers.map((m) => m.id === mid ? { ...m, ...patch } : m));
  const removeMember = (mid: string) =>
    set("householdMembers", draft.householdMembers.filter((m) => m.id !== mid));

  const addProgramme = (listName: string, reference: string) => {
    const p: ProgrammeSource = { id: uid(), listName, reference };
    set("programmes", [...draft.programmes, p]);
  };
  const removeProgramme = (pid: string) =>
    set("programmes", draft.programmes.filter((p) => p.id !== pid));

  const readPhoto = async (file: File, category: IntakeDocumentCategory, label: string) => {
    setPhotoBusy(true);
    try {
      const { dataUrl, sizeBytes } = await compressImage(file);
      set("documents", [
        ...draft.documents,
        {
          id: uid(), category,
          label: label || file.name.slice(0, 40),
          dataUrl, capturedAt: new Date().toISOString(),
          sizeBytes, status: "pending", rejectionReason: null,
        },
      ]);
      notify(`Document attached (${formatBytes(sizeBytes)})`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not process photo", "error");
    } finally {
      setPhotoBusy(false);
    }
  };
  const removeDocument = (did: string) =>
    set("documents", draft.documents.filter((d) => d.id !== did));

  // Signature capture (privacy acknowledgement)
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
    ctx.strokeStyle = "#183331";
    ctx.lineWidth = 2;
    ctx.stroke();
  };
  const endSig = () => { drawing.current = false; };
  const clearSig = () => { const c = sigRef.current; if (!c) return; c.getContext("2d")?.clearRect(0, 0, c.width, c.height); };
  const saveSig = () => {
    const c = sigRef.current; if (!c) return;
    const dataUrl = c.toDataURL("image/png");
    const sizeBytes = Math.round((dataUrl.length * 3) / 4);
    const evidenceId = uid();
    setDraft((d) => d ? {
      ...d,
      documents: [
        ...d.documents,
        {
          id: evidenceId,
          category: "other" as const,
          label: "Applicant signature",
          dataUrl,
          capturedAt: new Date().toISOString(),
          sizeBytes,
          status: "pending" as const,
          rejectionReason: null,
        },
      ],
      privacy: {
        noticeVersion: "privacy-v1.0-2026-10",
        lawfulBasis: "Public task — Housing Act 107/1997, s.2",
        acknowledgedAt: new Date().toISOString(),
        signatureEvidenceId: evidenceId,
        witnessedAlternative: d.privacy?.witnessedAlternative ?? false,
        witnessName: d.privacy?.witnessName ?? null,
        witnessIdNumber: d.privacy?.witnessIdNumber ?? null,
      },
    } : d);
    notify(`Signature saved (${formatBytes(sizeBytes)})`);
    clearSig();
  };
  const setWitnessMode = (w: boolean) => {
    setDraft((d) => d ? {
      ...d,
      privacy: {
        noticeVersion: d.privacy?.noticeVersion ?? "privacy-v1.0-2026-10",
        lawfulBasis: d.privacy?.lawfulBasis ?? "Public task — Housing Act 107/1997, s.2",
        acknowledgedAt: new Date().toISOString(),
        signatureEvidenceId: d.privacy?.signatureEvidenceId ?? null,
        witnessedAlternative: w,
        witnessName: d.privacy?.witnessName ?? "",
        witnessIdNumber: d.privacy?.witnessIdNumber ?? "",
      },
    } : d);
  };

  const submit = () => {
    if (!readiness.ok) {
      notify(
        `Missing: ${readiness.missing.slice(0, 2).join(", ")}${readiness.missing.length > 2 ? "…" : ""}`,
        "error",
      );
      return;
    }
    try {
      submitIntake(draft.id);
      if (isOnline) store.runSync();
      notify(`Intake ${draft.id} submitted for supervisor review`);
      navigate("/field");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Submit failed", "error");
    }
  };

  const abandon = () => {
    if (confirm("Discard this draft? Any captured data will be lost.")) {
      discardIntake(draft.id);
      navigate("/field");
    }
  };

  return (
    <>
      <button className="back-link" type="button" onClick={() => navigate("/field")}>
        <ArrowLeft size={15} /> Back to today
      </button>

      <div className="case-heading">
        <div>
          <SectionEyebrow>Field intake / {draft.id}</SectionEyebrow>
          <h1>New household intake</h1>
          <p>Captured by {currentUser.name} · {draft.status === "returned" ? "Returned — resubmit after corrections" : "Draft"} · Auto-saved</p>
        </div>
        <div className="heading-actions">
          <StatusPill label={draft.status === "returned" ? "returned" : "draft"} tone={draft.status === "returned" ? "danger" : "neutral"} />
          <button type="button" className="button button-quiet" onClick={abandon}>Discard</button>
        </div>
      </div>

      {draft.status === "returned" && draft.returnReason && (
        <div className="notice-banner" style={{ background: "var(--danger-light)", borderColor: "#e7c0ba" }}>
          <div className="notice-symbol" style={{ background: "#e8c1ba", color: "var(--danger)" }}><AlertTriangle size={16} /></div>
          <div><strong>Returned by {draft.reviewedBy}</strong><span>{draft.returnReason}</span></div>
        </div>
      )}

      <div className="capture-stepper">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            className={cx("capture-step", i === step && "is-active", i < step && "is-done")}
            onClick={() => { saveIntake(draft); setStep(i); }}
          >
            <span className="capture-step-dot">{i < step ? <Check size={12} /> : i + 1}</span><span>{s}</span>
          </button>
        ))}
      </div>

      <div className="capture-body">
        {/* ============ STEP 1: Duplicate check ============ */}
        {step === 0 && (
          <section className="panel capture-panel">
            <SectionEyebrow>Step 1 · Search before creating</SectionEyebrow>
            <h2>Is this person already on the register?</h2>
            <p className="capture-note">Enter the applicant's names. Matches appear live as you type.</p>
            <div className="form-grid" style={{ padding: 0, marginTop: 14 }}>
              <label className="capture-field"><span>First name</span><input value={draft.applicantFirstName} onChange={(e) => set("applicantFirstName", e.target.value)} placeholder="e.g. Noluthando" /></label>
              <label className="capture-field"><span>Surname</span><input value={draft.applicantSurname} onChange={(e) => set("applicantSurname", e.target.value)} placeholder="e.g. Mbeki" /></label>
            </div>

            {liveMatches.length === 0 && draft.applicantSurname.length >= 3 && (
              <div className="intake-empty-matches">
                <CheckCircle2 size={16} /> No matches on the register for this surname. Safe to continue as a new case.
              </div>
            )}

            {liveMatches.length > 0 && (
              <>
                <div className="intake-match-heading"><AlertTriangle size={14} /> {liveMatches.length} possible match{liveMatches.length > 1 ? "es" : ""} found — resolve before continuing</div>
                <div className="intake-match-list">
                  {liveMatches.map((m) => (
                    <div key={m.matchedCaseId} className="intake-match">
                      <div className="intake-match-info">
                        <strong>{m.matchedCaseName}</strong>
                        <span>{m.matchedCaseId} · {m.sourceProject}</span>
                        <span className="intake-match-reasons">Matched on: {m.matchedOn.join(" + ")}</span>
                      </div>
                      <span className={cx("intake-confidence", `confidence-${m.confidence}`)}>{m.confidence.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12 }}>
                  <div className="capture-label">Your resolution</div>
                  <label className="check-toggle"><input type="radio" name="dup" checked={draft.duplicateResolution === "confirmed_separate"} onChange={() => set("duplicateResolution", "confirmed_separate")} /> Confirmed separate person — I checked the register and this is a different household</label>
                  <label className="check-toggle"><input type="radio" name="dup" checked={draft.duplicateResolution === "not_duplicate"} onChange={() => set("duplicateResolution", "not_duplicate")} /> Not a duplicate — different identity, continue as new case</label>
                  <label className="check-toggle"><input type="radio" name="dup" checked={draft.duplicateResolution === "linked"} onChange={() => { set("duplicateResolution", "linked"); set("linkedToCaseId", liveMatches[0].matchedCaseId); }} /> Link to existing case — same household, new participation</label>
                  <label className="capture-field" style={{ marginTop: 8 }}>
                    <span>Resolution reason (required)</span>
                    <textarea value={draft.duplicateResolutionReason ?? ""} onChange={(e) => set("duplicateResolutionReason", e.target.value)} placeholder="e.g. Sister-in-law — different household in the same village" />
                  </label>
                </div>
              </>
            )}
          </section>
        )}

        {/* ============ STEP 2: Identity ============ */}
        {step === 1 && (
          <section className="panel capture-panel">
            <SectionEyebrow>Step 2 · Identity</SectionEyebrow>
            <h2>Applicant identity</h2>
            <div className="form-grid" style={{ padding: 0 }}>
              <label className="capture-field"><span>Document type</span>
                <select
                  value={draft.idDocumentType}
                  onChange={(e) => {
                    const v = e.target.value as IdDocumentType;
                    set("idDocumentType", v);
                    set("idFormatStatus", v === "none" ? "no_document" : "not_checked");
                    set("idFormatReason", "");
                  }}
                >
                  <option value="sa_id">South African ID</option><option value="passport">Passport</option>
                  <option value="refugee_permit">Refugee permit</option><option value="asylum_permit">Asylum seeker permit</option>
                  <option value="none">No document available</option>
                </select>
              </label>
              {draft.idDocumentType !== "none" ? (
                <label className="capture-field"><span>Document number</span>
                  <input
                    value={draft.idNumber}
                    onChange={(e) => {
                      set("idNumber", e.target.value);
                      if (draft.idFormatStatus !== "not_checked") { set("idFormatStatus", "not_checked"); set("idFormatReason", ""); }
                    }}
                    placeholder="e.g. 0000000000000"
                  />
                </label>
              ) : (
                <label className="capture-field"><span>Reason no document (required)</span>
                  <textarea
                    value={draft.idFormatReason}
                    onChange={(e) => set("idFormatReason", e.target.value)}
                    placeholder="e.g. Document lost; reissue pending from Home Affairs"
                  />
                </label>
              )}
            </div>

            {draft.idDocumentType !== "none" && (
              <div className="capture-evidence-row">
                <button type="button" className="button button-outline" onClick={checkId} disabled={!draft.idNumber.trim()}>
                  <IdCard size={15} /> Check ID format
                </button>
                {draft.idFormatStatus !== "not_checked" && (
                  <span className={cx("intake-format-chip", draft.idFormatStatus === "format_valid" ? "ok" : "bad")}>
                    {draft.idFormatStatus === "format_valid" ? "Format OK" : "Format invalid"} · {draft.idFormatReason}
                  </span>
                )}
              </div>
            )}

            <div className="capture-note"><AlertTriangle size={13} /> Format check is NOT identity verification. It confirms the number pattern, not that the document exists or belongs to the applicant.</div>

            <div style={{ marginTop: 16 }}>
              <div className="capture-label">Identity document photo</div>
              <div className="capture-evidence-row">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readPhoto(f, "identity", "Identity document");
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={photoBusy}
                >
                  <Camera size={15} /> {photoBusy ? "Processing…" : "Capture ID photo"}
                </button>
              </div>
              <DocumentGrid docs={draft.documents.filter((d) => d.category === "identity")} onRemove={removeDocument} />
            </div>
          </section>
        )}

        {/* ============ STEP 3: Household ============ */}
        {step === 2 && (
          <section className="panel capture-panel">
            <SectionEyebrow>Step 3 · Household</SectionEyebrow>
            <h2>Household composition</h2>
            <p className="capture-note">List every household member, including the applicant as head or spouse.</p>
            <div className="intake-member-list">
              {draft.householdMembers.length === 0 && <div className="capture-note" style={{ padding: 12, background: "var(--paper)", borderRadius: 6 }}>No members added yet. Start with the applicant.</div>}
              {draft.householdMembers.map((m) => (
                <div key={m.id} className="intake-member-row field-intake-member-row">
                  <input value={m.fullName} onChange={(e) => updateMember(m.id, { fullName: e.target.value })} placeholder="Full name" aria-label="Full name" />
                  <select value={m.relationship} onChange={(e) => updateMember(m.id, { relationship: e.target.value as HouseholdRelationship, relationshipOther: e.target.value === "other" ? m.relationshipOther : "" })} aria-label="Relationship">
                    <option value="head">Head</option><option value="spouse">Spouse</option><option value="partner">Partner</option>
                    <option value="child">Child</option><option value="parent">Parent</option><option value="sibling">Sibling</option>
                    <option value="grandchild">Grandchild</option><option value="other">Other</option>
                  </select>
                  {m.relationship === "other"
                    ? <input value={m.relationshipOther ?? ""} onChange={(e) => updateMember(m.id, { relationshipOther: e.target.value })} placeholder="Specify relationship" aria-label="Specify relationship" />
                    : <span className="household-empty-cell" aria-hidden="true" />}
                  <input
                    type="date"
                    value={m.dateOfBirth ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      const age = v ? Math.floor((Date.now() - new Date(v).getTime()) / (365.25 * 24 * 3600 * 1000)) : 0;
                      updateMember(m.id, { dateOfBirth: v || null, isMinor: age > 0 && age < 18 });
                    }}
                    aria-label="Date of birth"
                  />
                  <select value={m.dependency} onChange={(e) => updateMember(m.id, { dependency: e.target.value as "financial" | "non_financial" | "unknown" })} aria-label="Dependency">
                    <option value="unknown">Dependency?</option><option value="financial">Financial</option><option value="non_financial">Non-financial</option>
                  </select>
                  <button type="button" className="icon-button small" onClick={() => removeMember(m.id)} aria-label="Remove"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <button type="button" className="button button-outline intake-add-member" onClick={addMember}><Plus size={14} /> Add household member</button>
          </section>
        )}

        {/* ============ STEP 4: Contact ============ */}
        {step === 3 && (
          <section className="panel capture-panel">
            <SectionEyebrow>Step 4 · Contact</SectionEyebrow>
            <h2>Contact &amp; preferences</h2>
            <div className="form-grid" style={{ padding: 0 }}>
              <label className="capture-field"><span>Primary phone (required)</span><input value={draft.contact.primaryPhone} onChange={(e) => setDraft((d) => d ? { ...d, contact: { ...d.contact, primaryPhone: e.target.value } } : d)} placeholder="+27 71 000 0000" /></label>
              <label className="capture-field"><span>Alternate phone</span><input value={draft.contact.alternatePhone} onChange={(e) => setDraft((d) => d ? { ...d, contact: { ...d.contact, alternatePhone: e.target.value } } : d)} placeholder="Optional" /></label>
              <label className="capture-field"><span>Preferred language</span>
                <select value={draft.contact.preferredLanguage} onChange={(e) => setDraft((d) => d ? { ...d, contact: { ...d.contact, preferredLanguage: e.target.value as PreferredLanguage, preferredLanguageOther: e.target.value === "Other" ? d.contact.preferredLanguageOther : "" } } : d)}>
                  <option>English</option><option>isiXhosa</option><option>isiZulu</option><option>Sesotho</option><option>Afrikaans</option><option>Other</option>
                </select>
              </label>
              {draft.contact.preferredLanguage === "Other" && <label className="capture-field"><span>Specify preferred language</span><input value={draft.contact.preferredLanguageOther ?? ""} onChange={(e) => setDraft((d) => d ? { ...d, contact: { ...d.contact, preferredLanguageOther: e.target.value } } : d)} /></label>}
              <label className="capture-field"><span>Captured from</span>
                <select value={draft.capturedFrom} onChange={(e) => set("capturedFrom", e.target.value as Intake["capturedFrom"])}>
                  <option value="applicant">Applicant</option><option value="spouse_partner">Spouse / partner</option>
                  <option value="representative">Representative</option><option value="witness">Witness</option>
                </select>
              </label>
              <label className="capture-field"><span>Provided by (name)</span><input value={draft.capturedFromName} onChange={(e) => set("capturedFromName", e.target.value)} placeholder="Who gave this information" /></label>
            </div>
            <label className="check-toggle"><input type="checkbox" checked={draft.contact.communicationConsent} onChange={(e) => setDraft((d) => d ? { ...d, contact: { ...d.contact, communicationConsent: e.target.checked } } : d)} /> Applicant consents to SMS / WhatsApp reminders (optional — refusal does not block the case)</label>
            <div className="capture-note">Per SEC01, optional messaging consent is separate from the housing purpose. Refusing it does not affect the application.</div>
          </section>
        )}

        {/* ============ STEP 5: Location ============ */}
        {step === 4 && (
          <section className="panel capture-panel">
            <SectionEyebrow>Step 5 · Location</SectionEyebrow>
            <h2>Where is the household?</h2>
            <div className="form-grid" style={{ padding: 0 }}>
              <label className="capture-field"><span>Village / settlement (required)</span><input value={draft.location.village} onChange={(e) => setDraft((d) => d ? { ...d, location: { ...d.location, village: e.target.value } } : d)} placeholder="e.g. Ndlovu village" /></label>
              <label className="capture-field"><span>Ward</span><input value={draft.location.ward} onChange={(e) => setDraft((d) => d ? { ...d, location: { ...d.location, ward: e.target.value } } : d)} placeholder="e.g. Ward 14" /></label>
              <label className="capture-field"><span>Municipality</span><input value={draft.location.municipality} onChange={(e) => setDraft((d) => d ? { ...d, location: { ...d.location, municipality: e.target.value } } : d)} /></label>
              <label className="capture-field"><span>Tenure type</span>
                <select value={draft.tenureType} onChange={(e) => set("tenureType", e.target.value as TenureType)}>
                  <option value="communal">Communal land</option><option value="municipal">Municipal land</option>
                  <option value="state">State land</option><option value="farm">Farm</option><option value="private">Private</option><option value="unknown">Unknown</option>
                </select>
              </label>
              <label className="capture-field field-span-2"><span>Current dwelling</span><input value={draft.currentDwellingType} onChange={(e) => set("currentDwellingType", e.target.value)} placeholder="e.g. Informal structure, 2 rooms, no services" /></label>
            </div>
            <div className="capture-gps-row">
              <div>
                <div className="capture-label">GPS reading</div>
                <div className="capture-gps-value">{formatCoord(draft.location.gps)}</div>
              </div>
              <button type="button" className="button button-outline" onClick={grabGps}><Navigation size={15} /> {draft.location.gps ? "Re-read GPS" : "Capture GPS"}</button>
            </div>
            <label className="check-toggle"><input type="checkbox" checked={draft.location.manualOverride} onChange={(e) => setDraft((d) => d ? { ...d, location: { ...d.location, manualOverride: e.target.checked } } : d)} /> Mark location as manually placed (no GPS available)</label>
            {draft.location.manualOverride && (
              <label className="capture-field"><span>Reason for manual override</span><textarea value={draft.location.manualReason ?? ""} onChange={(e) => setDraft((d) => d ? { ...d, location: { ...d.location, manualReason: e.target.value } } : d)} placeholder="e.g. No GPS signal at the household; approximate pin placed from map" /></label>
            )}
          </section>
        )}

        {/* ============ STEP 6: Programme & needs ============ */}
        {step === 5 && (
          <section className="panel capture-panel">
            <SectionEyebrow>Step 6 · Programme &amp; needs</SectionEyebrow>
            <h2>Which source lists nominated this household?</h2>
            <p className="capture-note">A household can appear on more than one source list. Retain every source — do not merge.</p>

            <div className="programme-source-list">
              {draft.programmes.map((p) => (
                <div key={p.id} className="programme-source-row">
                  <strong style={{ fontSize: 12 }}>{p.listName}</strong>
                  <span style={{ color: "var(--muted)", fontSize: 11, flex: 1 }}>Ref: {p.reference}</span>
                  <button type="button" className="icon-button small" onClick={() => removeProgramme(p.id)} aria-label="Remove source"><X size={14} /></button>
                </div>
              ))}
              {draft.programmes.length === 0 && <div className="capture-note" style={{ padding: 12, background: "var(--paper)", borderRadius: 6 }}>No sources added yet.</div>}
            </div>

            <div className="form-grid" style={{ padding: 0 }}>
              <label className="capture-field"><span>Source list</span>
                <select id="prog-listname" defaultValue="Disaster register">
                  <option>Municipal source list</option><option>Disaster register</option>
                  <option>Destitute register</option><option>Vulnerable household list</option><option>Replacement list</option>
                </select>
              </label>
              <label className="capture-field"><span>Reference</span><input id="prog-ref" placeholder="e.g. DR-2026-0044" /></label>
            </div>
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                const l = (document.getElementById("prog-listname") as HTMLSelectElement)?.value ?? "Municipal source list";
                const r = (document.getElementById("prog-ref") as HTMLInputElement)?.value ?? "";
                if (r.trim()) {
                  addProgramme(l, r.trim());
                  (document.getElementById("prog-ref") as HTMLInputElement).value = "";
                }
              }}
            >
              <Plus size={14} /> Add source
            </button>

            <div style={{ marginTop: 20 }}>
              <div className="capture-label">Confirmed programme category</div>
              <select
                value={draft.confirmedProgrammeCategory}
                onChange={(e) => set("confirmedProgrammeCategory", e.target.value as ProgrammeCategory)}
                style={{ width: "100%", padding: 8, border: "1px solid var(--line)", borderRadius: 6, fontSize: 11, background: "var(--paper)" }}
              >
                <option value="unresolved">Unresolved — do not confirm until evidence is approved</option>
                <option value="conventional">Conventional</option><option value="rural">Rural</option>
                <option value="disaster">Disaster</option><option value="destitute">Destitute</option><option value="vulnerable">Vulnerable</option>
              </select>
              <label className="capture-field" style={{ marginTop: 8 }}><span>Category note (if unresolved, record why)</span><textarea value={draft.programmeCategoryNote} onChange={(e) => set("programmeCategoryNote", e.target.value)} placeholder="e.g. Household appears on both Disaster and Destitute lists — classification pending ECDHS determination" /></label>
            </div>

            <div style={{ marginTop: 20 }}>
              <div className="capture-label">Vulnerability (sensitive)</div>
              <div className="form-grid" style={{ padding: 0 }}>
                <label className="capture-field"><span>Category</span>
                  <select value={draft.vulnerability.category} onChange={(e) => setDraft((d) => d ? { ...d, vulnerability: { ...d.vulnerability, category: e.target.value as VulnerabilityCategory } } : d)}>
                    <option value="none">None recorded</option><option value="elderly">Elderly</option>
                    <option value="disability">Disability</option><option value="child_headed">Child-headed</option>
                    <option value="chronic_illness">Chronic illness</option><option value="other">Other</option>
                  </select>
                </label>
                <label className="capture-field"><span>{draft.vulnerability.category === "other" ? "Specify vulnerability" : "Detail"}</span><input value={draft.vulnerability.detail} onChange={(e) => setDraft((d) => d ? { ...d, vulnerability: { ...d.vulnerability, detail: e.target.value } } : d)} placeholder={draft.vulnerability.category === "other" ? "Describe the vulnerability" : "Only what was observed or declared"} /></label>
              </div>
              <label className="check-toggle"><input type="checkbox" checked={draft.vulnerability.recordedWithConsent} onChange={(e) => setDraft((d) => d ? { ...d, vulnerability: { ...d.vulnerability, recordedWithConsent: e.target.checked } } : d)} /> Applicant consented to this sensitive information being recorded (SEC01)</label>
            </div>
          </section>
        )}

        {/* ============ STEP 7: Privacy & acknowledgement ============ */}
        {step === 6 && (
          <section className="panel capture-panel">
            <SectionEyebrow>Step 7 · Privacy &amp; acknowledgement</SectionEyebrow>
            <h2>Privacy notice and acknowledgement</h2>
            <div className="privacy-block">
              <strong>Privacy notice v1.0 · 2026-10</strong><br />
              This information is collected under the Housing Act 107/1997 and POPIA to determine eligibility for a housing subsidy. It will be shared with the Eastern Cape Department of Human Settlements, NHBRC, and appointed contractors as required for delivery. Identity numbers are masked in reports. You may request access to or correction of your information through the Ayavelisa Information Officer. Refusing optional messaging does not block the case.
            </div>
            <label className="check-toggle"><input type="checkbox" checked={draft.privacy?.witnessedAlternative ?? false} onChange={(e) => setWitnessMode(e.target.checked)} /> Applicant cannot sign — record witnessed alternative</label>

            {!draft.privacy?.witnessedAlternative ? (
              <>
                <div className="capture-signature-wrap">
                  <canvas
                    ref={sigRef}
                    width={560}
                    height={180}
                    className="capture-signature"
                    onPointerDown={startSig}
                    onPointerMove={moveSig}
                    onPointerUp={endSig}
                    onPointerLeave={endSig}
                  />
                  <div className="capture-signature-actions">
                    <button type="button" className="text-button" onClick={clearSig}>Clear</button>
                    <button type="button" className="button button-primary" onClick={saveSig}><Check size={14} /> Save signature</button>
                  </div>
                </div>
                <div className="capture-note"><Clock size={13} /> Sign with finger or mouse. The notice version and lawful basis are recorded automatically.</div>
              </>
            ) : (
              <div className="form-grid" style={{ padding: 0, marginTop: 12 }}>
                <label className="capture-field"><span>Witness name (required)</span>
                  <input
                    value={draft.privacy?.witnessName ?? ""}
                    onChange={(e) => setDraft((d) => d ? {
                      ...d,
                      privacy: {
                        ...(d.privacy ?? {
                          noticeVersion: "privacy-v1.0-2026-10",
                          lawfulBasis: "Public task — Housing Act 107/1997, s.2",
                          acknowledgedAt: new Date().toISOString(),
                          signatureEvidenceId: null,
                          witnessedAlternative: true,
                          witnessName: "",
                          witnessIdNumber: "",
                        }),
                        witnessName: e.target.value,
                      },
                    } : d)}
                    placeholder="Full name of witness"
                  />
                </label>
                <label className="capture-field"><span>Witness ID</span>
                  <input
                    value={draft.privacy?.witnessIdNumber ?? ""}
                    onChange={(e) => setDraft((d) => d ? {
                      ...d,
                      privacy: {
                        ...(d.privacy ?? {
                          noticeVersion: "privacy-v1.0-2026-10",
                          lawfulBasis: "Public task — Housing Act 107/1997, s.2",
                          acknowledgedAt: new Date().toISOString(),
                          signatureEvidenceId: null,
                          witnessedAlternative: true,
                          witnessName: "",
                          witnessIdNumber: "",
                        }),
                        witnessIdNumber: e.target.value,
                      },
                    } : d)}
                    placeholder="Witness ID number"
                  />
                </label>
              </div>
            )}

            {draft.privacy?.signatureEvidenceId && (
              <div className="intake-empty-matches" style={{ marginTop: 12 }}>
                <CheckCircle2 size={16} /> Signature captured · notice v{draft.privacy.noticeVersion.split("-")[1]} · {new Date(draft.privacy.acknowledgedAt).toLocaleString()}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <div className="capture-label">Supporting documents</div>
              <div className="capture-evidence-row">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readPhoto(f, photoCategory, photoCategory === "other" ? `${photoCategoryOther.trim()} · ${f.name}` : f.name);
                    e.target.value = "";
                  }}
                />
                <select
                  value={photoCategory}
                  onChange={(e) => setPhotoCategory(e.target.value as IntakeDocumentCategory)}
                  style={{ padding: 6, fontSize: 11, border: "1px solid var(--line)", borderRadius: 6, background: "var(--paper)" }}
                >
                  <option value="identity">Identity</option><option value="proof_of_residence">Proof of residence</option>
                  <option value="income_evidence">Income evidence</option><option value="prior_benefit_check">Prior benefit check</option>
                  <option value="property_check">Property check</option><option value="tenure_evidence">Tenure evidence</option>
                  <option value="other">Other</option>
                </select>
                {photoCategory === "other" && <input value={photoCategoryOther} onChange={(e) => setPhotoCategoryOther(e.target.value)} aria-label="Describe other document" placeholder="Describe document" />}
                <button type="button" className="button button-outline" onClick={() => fileRef.current?.click()} disabled={photoBusy || (photoCategory === "other" && !photoCategoryOther.trim())}><Camera size={15} /> {photoBusy ? "Processing…" : "Capture"}</button>
              </div>
              <DocumentGrid docs={draft.documents.filter((d) => d.category !== "identity")} onRemove={removeDocument} />
            </div>
          </section>
        )}

        {/* ============ STEP 8: Review & submit ============ */}
        {step === 7 && (
          <section className="panel capture-panel">
            <SectionEyebrow>Step 8 · Review &amp; submit</SectionEyebrow>
            <h2>Confirm before submitting</h2>
            {readiness.missing.length > 0 && (
              <div className="notice-banner" style={{ background: "var(--danger-light)", borderColor: "#e7c0ba", marginTop: 10 }}>
                <div className="notice-symbol" style={{ background: "#e8c1ba", color: "var(--danger)" }}><AlertTriangle size={16} /></div>
                <div><strong>Incomplete — {readiness.missing.length} item{readiness.missing.length > 1 ? "s" : ""} outstanding</strong><span>{readiness.missing.join(" · ")}</span></div>
              </div>
            )}

            <div className="intake-summary">
              <div className="intake-summary-section">
                <h3><Users size={14} /> Applicant</h3>
                <dl className="intake-summary-list">
                  <dt>Name</dt><dd>{draft.applicantFirstName} {draft.applicantSurname}</dd>
                  <dt>Document</dt><dd>{draft.idDocumentType === "none" ? "None available — " + draft.idFormatReason : `${draft.idDocumentType.toUpperCase()} · ${draft.idNumber}`}</dd>
                  <dt>Format check</dt>
                  <dd>
                    {draft.idFormatStatus === "format_valid"
                      ? "✓ Format passes (not identity verification)"
                      : draft.idFormatStatus === "no_document"
                        ? "Reason recorded"
                        : draft.idFormatStatus === "format_invalid"
                          ? "✗ Invalid format"
                          : "Not yet checked"}
                  </dd>
                  <dt>Household</dt><dd>{memberCount} member{memberCount !== 1 ? "s" : ""}</dd>
                  <dt>Contact</dt><dd>{draft.contact.primaryPhone} · {draft.contact.preferredLanguage}</dd>
                  <dt>Communication consent</dt><dd>{draft.contact.communicationConsent ? "Granted" : "Not granted (optional)"}</dd>
                </dl>
              </div>
              <div className="intake-summary-section">
                <h3><MapPin size={14} /> Location &amp; tenure</h3>
                <dl className="intake-summary-list">
                  <dt>Village / ward</dt><dd>{draft.location.village || "—"} · {draft.location.ward || "—"}</dd>
                  <dt>Municipality</dt><dd>{draft.location.municipality}</dd>
                  <dt>GPS</dt><dd>{formatCoord(draft.location.gps)}</dd>
                  <dt>Tenure</dt><dd>{draft.tenureType}</dd>
                  <dt>Current dwelling</dt><dd>{draft.currentDwellingType || "—"}</dd>
                </dl>
              </div>
              <div className="intake-summary-section">
                <h3>Programme &amp; needs</h3>
                <dl className="intake-summary-list">
                  <dt>Sources</dt><dd>{draft.programmes.length === 0 ? "None" : draft.programmes.map((p) => `${p.listName} (${p.reference})`).join(" · ")}</dd>
                  <dt>Category</dt><dd>{draft.confirmedProgrammeCategory === "unresolved" ? "⚠ Unresolved — needs ECDHS determination" : draft.confirmedProgrammeCategory}</dd>
                  {draft.programmeCategoryNote && <><dt>Note</dt><dd>{draft.programmeCategoryNote}</dd></>}
                  <dt>Vulnerability</dt><dd>{draft.vulnerability.category === "none" ? "None recorded" : `${draft.vulnerability.category}: ${draft.vulnerability.detail || "no detail"}`}</dd>
                </dl>
              </div>
              <div className="intake-summary-section">
                <h3>Privacy &amp; evidence</h3>
                <dl className="intake-summary-list">
                  <dt>Privacy notice</dt><dd>{draft.privacy ? `Acknowledged ${new Date(draft.privacy.acknowledgedAt).toLocaleString()}` : "⚠ Not acknowledged"}</dd>
                  <dt>Signature</dt><dd>{draft.privacy?.signatureEvidenceId ? "Captured" : draft.privacy?.witnessedAlternative ? `Witnessed by ${draft.privacy.witnessName || "—"}` : "—"}</dd>
                  <dt>Documents</dt><dd>{draft.documents.length} attached</dd>
                  {draft.duplicateMatches.length > 0 && <><dt>Duplicate check</dt><dd>{draft.duplicateResolution ? `Resolved: ${draft.duplicateResolution}` : "⚠ Not resolved"}</dd></>}
                </dl>
              </div>
            </div>

            <div className="capture-submit-row" style={{ marginTop: 16 }}>
              <button type="button" className="button button-quiet" onClick={() => { saveIntake(draft); notify("Draft saved"); }}><Save size={14} /> Save draft</button>
              <button type="button" className="button button-primary" onClick={submit} disabled={!readiness.ok}><Check size={15} /> Submit for review</button>
            </div>
          </section>
        )}
      </div>

      <div className="capture-nav">
        <button type="button" className="button button-quiet" onClick={prev} disabled={step === 0}><ArrowLeft size={14} /> Previous</button>
        <span className="capture-nav-label">Step {step + 1} of {STEPS.length} · Draft saved {new Date(draft.startedAt).toLocaleTimeString()}</span>
        <button type="button" className="button button-quiet" onClick={next} disabled={step === STEPS.length - 1}>Next <ArrowRight size={14} /></button>
      </div>
    </>
  );
}

function DocumentGrid({
  docs,
  onRemove,
}: {
  docs: { id: string; label: string; dataUrl: string; capturedAt: string; sizeBytes: number; category: IntakeDocumentCategory }[];
  onRemove: (id: string) => void;
}) {
  if (docs.length === 0) return null;
  return (
    <div className="evidence-grid">
      {docs.map((d) => (
        <div className="evidence-card" key={d.id}>
          <img src={d.dataUrl} alt={d.label} />
          <div className="evidence-meta">
            <div><strong>{d.label}</strong><span>{d.category} · {formatBytes(d.sizeBytes)}</span></div>
            <button type="button" className="icon-button small" onClick={() => onRemove(d.id)} aria-label="Remove"><Trash2 size={13} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}