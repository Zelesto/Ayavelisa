import type { VisitForm } from "./types";

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function blankVisitForm(): VisitForm {
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

export function migrateVisitForm(form: VisitForm | null): VisitForm {
  if (!form) return blankVisitForm();
  const merged: VisitForm = { ...blankVisitForm(), ...form, schemaVersion: 3 };
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

export function seedVisitForm(partial: Partial<VisitForm> = {}): VisitForm {
  return { ...blankVisitForm(), ...partial, schemaVersion: 3 };
}
