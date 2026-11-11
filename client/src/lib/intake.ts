import type { CaseRecord, DuplicateMatch, Intake, ProgrammeSource } from "./types";

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ").replace(/[^a-z\s]/g, "");

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n; if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

/** Detect probable duplicates across the whole register. Returns matches sorted by confidence. */
export function findDuplicateMatches(
  input: { firstName: string; surname: string; idNumber: string; phone: string; location: string },
  cases: CaseRecord[],
): DuplicateMatch[] {
  const full = norm(`${input.firstName} ${input.surname}`);
  const surname = norm(input.surname);
  const loc = norm(input.location).slice(0, 12);
  if (!surname) return [];
  const out: DuplicateMatch[] = [];
  for (const c of cases) {
    const caseFull = norm(c.name);
    const matchedOn: string[] = [];
    let conf: "exact" | "high" | "medium" | "low" | null = null;
    if (caseFull === full && full.length > 2) { matchedOn.push("full_name_exact"); conf = "exact"; }
    else if (caseFull.endsWith(surname) && surname.length >= 3) { matchedOn.push("surname_match"); conf = conf ?? "high"; }
    else if (levenshtein(caseFull, full) <= 3 && full.length >= 4) { matchedOn.push("name_similar"); conf = conf ?? "medium"; }
    if (matchedOn.length === 0) continue;
    if (loc && c.location.toLowerCase().includes(loc)) {
      matchedOn.push("location");
      const boosted = conf === "medium" || conf === null ? "high" : conf;
      conf = boosted === "high" ? "exact" : boosted;
    }
    out.push({ matchedCaseId: c.id, matchedCaseName: c.name, confidence: conf ?? "low", matchedOn, sourceProject: c.project });
  }
  const order = { exact: 4, high: 3, medium: 2, low: 1 };
  return out.sort((a, b) => order[b.confidence] - order[a.confidence]).slice(0, 5);
}

/** Format-only check. Per DAT01 this MUST NOT be described as identity verification. */
export function checkSaIdFormat(id: string): { status: "format_valid" | "format_invalid"; reason: string } {
  const c = id.replace(/\s/g, "");
  if (!/^\d{13}$/.test(c)) return { status: "format_invalid", reason: "SA ID must be exactly 13 digits" };
  const mm = parseInt(c.slice(2, 4), 10);
  const dd = parseInt(c.slice(4, 6), 10);
  if (mm < 1 || mm > 12) return { status: "format_invalid", reason: "Invalid month in ID prefix" };
  if (dd < 1 || dd > 31) return { status: "format_invalid", reason: "Invalid day in ID prefix" };
  return { status: "format_valid", reason: "Format passes â€” this is NOT identity verification" };
}

export function emptyIntake(id: string, capturedBy: string): Intake {
  return {
    id, status: "draft",
    duplicateSearchPerformed: false, duplicateMatches: [], duplicateResolution: null, duplicateResolutionReason: null, linkedToCaseId: null,
    applicantFirstName: "", applicantSurname: "",
    idDocumentType: "sa_id", idNumber: "", idFormatStatus: "not_checked", idFormatReason: "",
    householdMembers: [],
    contact: { primaryPhone: "", alternatePhone: "", preferredLanguage: "English", communicationConsent: false },
    location: { gps: null, manualOverride: false, manualReason: null, village: "", ward: "", municipality: "Mthatha" },
    tenureType: "unknown", currentDwellingType: "",
    programmes: [], confirmedProgrammeCategory: "unresolved", programmeCategoryNote: "",
    vulnerability: { category: "none", detail: "", requiresReasonableAccommodation: false, recordedWithConsent: false },
    privacy: null, documents: [],
    capturedBy, capturedFrom: "applicant", capturedFromName: "",
    startedAt: new Date().toISOString(), submittedAt: null, reviewedAt: null, reviewedBy: null,
    returnedAt: null, returnReason: null, createdCaseId: null,
  };
}

export function intakeReadyForSubmit(i: Intake): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!i.duplicateSearchPerformed) missing.push("Duplicate search not performed");
  if (i.duplicateMatches.length > 0 && !i.duplicateResolution) missing.push("Duplicate resolution required");
  if (!i.applicantFirstName.trim()) missing.push("Applicant first name");
  if (!i.applicantSurname.trim()) missing.push("Applicant surname");
  if (i.idDocumentType !== "none" && !i.idNumber.trim()) missing.push("ID number");
  if (i.idDocumentType === "none" && !i.idFormatReason.trim()) missing.push("Reason for no ID document");
  if (i.householdMembers.filter(m => m.fullName.trim()).length === 0) missing.push("At least one household member");
  if (!i.contact.primaryPhone.trim()) missing.push("Primary phone");
  if (!i.location.village.trim()) missing.push("Village");
  if (i.programmes.length === 0) missing.push("At least one programme source");
  if (!i.privacy) missing.push("Privacy acknowledgement");
  return { ok: missing.length === 0, missing };
}

export function programmeLabel(p: ProgrammeSource): string { return `${p.listName} Â· ${p.reference}`; }