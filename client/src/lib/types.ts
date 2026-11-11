/* =========================================================================
   Ayavelisa — shared types
   Single source of truth. Do not add duplicate definitions.
   ========================================================================= */

export type Tone = "success" | "warning" | "danger" | "neutral" | "info" | "accent";
export type Persona = "fieldworker" | "supervisor" | "reviewer";
export type SeedKind = "empty" | "fresh_day" | "mid_day" | "end_of_day" | "returned_visit" | "portfolio";

/* =========================================================================
   Field intake — referenced by visit forms, must come first
   ========================================================================= */

export type HouseholdRelationship =
  | "head" | "spouse" | "partner" | "child" | "parent" | "sibling" | "grandchild" | "other";

export type PreferredLanguage =
  | "English" | "isiXhosa" | "isiZulu" | "Sesotho" | "Afrikaans" | "Other";

export type TenureType =
  | "communal" | "municipal" | "state" | "farm" | "private" | "unknown";

export type ProgrammeCategory =
  | "conventional" | "rural" | "disaster" | "destitute" | "vulnerable" | "unresolved";

export type VulnerabilityCategory =
  | "elderly" | "disability" | "child_headed" | "chronic_illness" | "other" | "none";

/* =========================================================================
   GPS + Evidence
   ========================================================================= */

export type GpsCapture = {
  lat: number;
  lng: number;
  accuracyM: number;
  capturedAt: string;
  source: "device" | "manual" | "unavailable";
};

export type VisitEvidenceCategory =
  | "identity"
  | "proof_of_residence"
  | "income_evidence"
  | "prior_benefit_check"
  | "property_check"
  | "tenure_evidence"
  | "dwelling"
  | "other";

export type LegibilityStatus = "unreviewed" | "legible" | "unreadable";

export type EvidenceProvenance = {
  deviceRef: string | null;
  capturedAtDevice: string | null;
  coordinates: { lat: number; lng: number } | null;
  fileHash: string | null;
  transformation: string | null;
};

export type Evidence = {
  id: string;
  kind: "photo" | "signature" | "document";
  category?: VisitEvidenceCategory;
  label: string;
  dataUrl: string;
  capturedAt: string;
  sizeBytes: number;
  provenance?: EvidenceProvenance;
  legibilityStatus?: LegibilityStatus;
  legibilityNote?: string;
};

/* =========================================================================
   Visit v3 form + summary
   ========================================================================= */

export type CheckSource = "declared" | "observed" | "externally_confirmed";

export type VisitOutcome =
  | "verified" | "absence" | "refused" | "partial" | "unresolved" | "withdrawn";

export type AcknowledgementMode = "signature" | "witnessed_alternative";

export type WitnessDetails = {
  witnessName: string;
  witnessIdNumber: string;
  witnessRelationship: string;
  reason: string;
};

export type VisitHouseholdMember = {
  id: string;
  declaredMemberId: string | null;
  fullName: string;
  relationship: HouseholdRelationship;
  relationshipOther?: string;
  dateOfBirth: string | null;
  present: boolean;
  note: string;
};

export type ProofOfResidenceStatus = "captured" | "outstanding" | "not_required";
export type PriorAssistanceStatus = "none" | "previous_rdp" | "previous_subsidy" | "unknown";

export type GrievanceCategory = "identity" | "category" | "allocation" | "evidence" | "other";
export type GrievanceStatus = "open" | "in_review" | "resolved" | "escalated";

export type Grievance = {
  id: string;
  raisedAt: string;
  raisedBy: string;
  description: string;
  categoryOther?: string;
  category: GrievanceCategory;
  status: GrievanceStatus;
  resolutionOwner: string | null;
  dueDate: string | null;
  resolution: string | null;
  resolvedAt: string | null;
};

export type VisitSummary = {
  declaredMembers: number;
  observedMembers: number;
  householdVariance: number;
  identityVerified: boolean;
  identityMatches: boolean;
  primaryPhoneVerified: boolean;
  priorAssistanceStatus: PriorAssistanceStatus | "not_checked";
  proofOfResidenceStatus: ProofOfResidenceStatus;
  vulnerabilityCategory: VulnerabilityCategory;
  computedAt: string;
};

export type VisitForm = {
  schemaVersion: 3;

  // Arrival & location
  arrivalConfirmed: boolean;
  visitType: "initial" | "follow_up" | "revisit" | "verification";
  gps: GpsCapture | null;
  gpsOutsideBoundary: boolean;
  gpsLowAccuracy: boolean;
  gpsManualCorrection: boolean;
  gpsManualReason: string;
  gpsOriginalReading: string | null;
  arrivalAt: string | null;
  departedAt: string | null;
  intervieweeName: string;
  intervieweeRelationship: HouseholdRelationship | "other";
  intervieweeRelationshipOther?: string;
  intervieweeIsApplicant: boolean;
  workerDeclaration: boolean;

  // Location observation
  villageObserved: string;
  wardObserved: string;
  municipalityObserved: string;
  locationSource: CheckSource;
  locationDiscrepancyNote: string;

  // Identity
  identityType: string;
  identityNumber: string;
  identityVerified: boolean;
  identityMatchesRegister: boolean;
  identitySource: CheckSource;
  identityNote: string;

  // Household
  householdMembers: VisitHouseholdMember[];
  householdSource: CheckSource;
  undeclaredPersonsPresent: number;
  undeclaredPersonsNote: string;
  /** @deprecated v1/v2 only — derive from householdMembers.filter(m => m.present).length */
  householdObserved: number;
  /** @deprecated v1/v2 only */
  occupancyObservation: string;

  // Contact
  primaryPhone: string;
  primaryPhoneVerified: boolean;
  primaryPhoneSource: CheckSource;
  alternatePhone: string;
  preferredLanguage: PreferredLanguage;
  preferredLanguageOther?: string;
  communicationConsent: boolean;

  // Dwelling & tenure
  dwellingType: string;
  dwellingCondition: string;
  dwellingSource: CheckSource;
  tenureType: TenureType;
  tenureEvidenceCaptured: boolean;
  tenureSource: CheckSource;

  // Programme
  programmeSourceListName: string;
  programmeReference: string;
  programmeSourceConfirmed: boolean;
  programmeSource: CheckSource;
  confirmedProgrammeCategory: ProgrammeCategory;
  programmeNote: string;

  // Vulnerability
  vulnerabilityCategory: VulnerabilityCategory;
  vulnerabilityDetail: string;
  vulnerabilityRecordedWithConsent: boolean;
  requiresReasonableAccommodation: boolean;
  vulnerabilitySource: CheckSource;

  // Prior assistance
  priorAssistanceChecked: boolean;
  priorAssistanceStatus: PriorAssistanceStatus;
  priorAssistanceSource: CheckSource;
  priorAssistanceNote: string;

  // Proof of residence
  proofOfResidenceStatus: ProofOfResidenceStatus;
  proofOfResidenceSource: CheckSource;
  proofOfResidenceNote: string;

  // Outcome
  outcome: VisitOutcome;
  revisitDate: string | null;
  outcomeNote: string;

  // Acknowledgement
  acknowledgementMode: AcknowledgementMode;
  formVersion: string;
  acknowledgementLanguage: PreferredLanguage;
  acknowledgementLanguageOther?: string;
  representativeAuthority: string | null;
  witness: WitnessDetails | null;

  // Grievances
  grievances: Grievance[];

  // Declaration
  fieldworkerName: string;
  notes: string;
};

export type VisitStatus = "assigned" | "in_progress" | "captured" | "returned" | "approved";

export type Visit = {
  id: string;
  caseId: string;
  assignedTo: string;
  scheduledFor: string;
  status: VisitStatus;
  form: VisitForm | null;
  evidence: Evidence[];
  startedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  returnedAt: string | null;
  returnReason: string | null;
  reviewedBy: string | null;
  synced: boolean;
  summary?: VisitSummary | null;
};

/* =========================================================================
   Case + blockers + activity
   ========================================================================= */

export type SourceTag = { listName: string; reference: string; importedAt: string };

export type VerifyNowResult = {
  id: string;
  provider: "VerifyNow";
  status: "not_configured" | "completed" | "failed";
  outcome: "not_run" | "match" | "no_match" | "review_required";
  reference: string;
  summary: string;
  checkedAt: string;
  checkedBy: string;
  simulated: boolean;
};

export type CaseRecord = {
  id: string;
  name: string;
  household: string;
  project: string;
  location: string;
  source: string;
  verification: string;
  verificationTone: Tone;
  subsidy: string;
  subsidyTone: Tone;
  readiness: string;
  nextAction: string;
  updated: string;
  members: number;
  site: string;
  sources?: SourceTag[];
  intakeId?: string;
  latestVisitSummary?: VisitSummary | null;
  archivedAt?: string | null;
  assignedTo?: string;
  verifyNowChecks?: VerifyNowResult[];
  departmentPacketExportedAt?: string | null;
};

export type Blocker = {
  id: string;
  label: string;
  detail: string;
  action: string;
  primary: "request" | "assign";
  status: "open" | "requested" | "assigned" | "resolved";
};

export type ActivityKind = "sync" | "verify" | "upload" | "gate" | "inspection" | "intake" | "action" | "visit";
export type Activity = {
  id: string;
  kind: ActivityKind;
  tone: "sage" | "blue" | "coral" | "sand" | "default";
  title: string;
  detail: string;
  time: string;
  at: string;
};

export type SyncState = { pendingUploads: number; lastSync: string | null; runs: number };

/* =========================================================================
   Import / reconciliation
   ========================================================================= */

export type ImportRowStatus = "accepted" | "rejected" | "duplicate" | "unmatched";
export type ImportRow = {
  rowNumber: number;
  raw: Record<string, string>;
  status: ImportRowStatus;
  reason: string | null;
  caseId: string | null;
};
export type ImportBatch = {
  id: string;
  fileName: string;
  source: string;
  totalRows: number;
  accepted: number;
  rejected: number;
  duplicate: number;
  unmatched: number;
  stagedAt: string;
  committedAt: string | null;
  reversedAt: string | null;
  rows: ImportRow[];
};

export type EnrolmentStatus = "not_started" | "submitted" | "queried" | "confirmed" | "outstanding";
export type Enrolment = {
  id: string;
  scope: "project" | "home";
  projectId: string;
  plotRef: string | null;
  caseId: string | null;
  status: EnrolmentStatus;
  certificateRef: string | null;
  submittedAt: string | null;
  confirmedAt: string | null;
  queryText: string | null;
};

export type WorkStage =
  | "site_establishment" | "foundations" | "slab" | "walls" | "roof"
  | "services" | "finishes" | "practical_completion";

export type WorkUnit = {
  id: string;
  projectId: string;
  plotRef: string;
  caseId: string | null;
  stage: WorkStage;
  reportedAt: string | null;
  inspectedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  claimId: string | null;
};

export type ClaimStatus = "draft" | "submitted" | "certified" | "paid" | "disputed";
export type Claim = {
  id: string;
  unitIds: string[];
  submittedAt: string;
  certifiedAmount: number | null;
  paidAmount: number | null;
  status: ClaimStatus;
};

export type ChangeEntity = "allocation" | "identity" | "classification" | "approval" | "milestone";
export type ChangeRequestStatus = "pending" | "approved" | "rejected";
export type ChangeRequest = {
  id: string;
  entity: ChangeEntity;
  entityId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  requestedBy: string;
  requestedAt: string;
  status: ChangeRequestStatus;
  reason: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
};

export type ReportStatus = "draft" | "issued" | "superseded";
export type IssuedReport = {
  id: string;
  period: string;
  issuedAt: string;
  issuedBy: string;
  snapshotHash: string;
  snapshotData: Record<string, unknown>;
  status: ReportStatus;
  revision: number;
};

export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  persona: Persona;
  action: string;
  entity: string;
  entityId: string;
  before: unknown | null;
  after: unknown | null;
  reason: string | null;
};

export type Conflict = {
  id: string;
  entity: string;
  entityId: string;
  localVersion: unknown;
  remoteVersion: unknown;
  detectedAt: string;
  resolvedAt: string | null;
  resolution: "keep_local" | "keep_remote" | "merge" | null;
};

export type SnagSeverity = "minor" | "major" | "critical";
export type Snag = {
  id: string;
  description: string;
  severity: SnagSeverity;
  openedAt: string;
  closedAt: string | null;
  reportedBy: string;
  resolutionNote: string | null;
};

export type Handover = {
  id: string;
  caseId: string;
  plotRef: string;
  practicalCompletionDate: string | null;
  inspectionDate: string | null;
  handoverDate: string | null;
  keysHandedOver: boolean;
  occupationDate: string | null;
  snags: Snag[];
  closedOutAt: string | null;
};

export type SubmissionBatchStatus = "draft" | "dispatched" | "acknowledged" | "partially_acknowledged";
export type SubmissionBatch = {
  id: string;
  reference: string;
  caseIds: string[];
  dispatchedAt: string;
  acknowledgedCaseIds: string[];
  queriedCaseIds: string[];
  rejectedCaseIds: string[];
  status: SubmissionBatchStatus;
  returnFileRef: string | null;
};

/* =========================================================================
   Lead management
   ========================================================================= */

export type LeadSourceStatus = "Approved" | "Failed searches" | "Received" | "Query pending";
export type LeadStatus =
  | "New" | "Assigned" | "Visit pending" | "Survey in progress" | "Survey submitted"
  | "Unreachable" | "Visit unsuccessful" | "Refused participation" | "On hold" | "Converted";

export type LeadImportBatch = {
  id: string;
  batchRef: string;
  project: string;
  programme: string;
  sourceFileName: string;
  importingUser: string;
  importedAt: string;
  rowCount: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  columnMapping: Record<string, string>;
  fileType: "xlsx" | "csv";
  retentionRef: string;
};

export type BeneficiaryLead = {
  id: string;
  leadRef: string;
  batchRef: string;
  project: string;
  programme: string;
  sourceStatus: LeadSourceStatus;
  leadStatus: LeadStatus;
  assignedTo: string | null;
  surname: string;
  fullNames: string;
  idNo: string;
  siteNo: string;
  township: string;
  sourceData: Record<string, string>;
  createdAt: string;
  lastUpdatedAt: string;
  linkedEnquiryId: string | null;
  visitHistory: string[];
  duplicateFlag: boolean;
};

/* =========================================================================
   Field intake
   ========================================================================= */

export type IdDocumentType = "sa_id" | "passport" | "refugee_permit" | "asylum_permit" | "none";
export type IdFormatStatus = "format_valid" | "format_invalid" | "not_checked" | "no_document";

export type HouseholdMember = {
  id: string;
  fullName: string;
  relationship: HouseholdRelationship;
  relationshipOther?: string;
  dateOfBirth: string | null;
  idNumber: string | null;
  dependency: "financial" | "non_financial" | "unknown";
  isMinor: boolean;
  note: string | null;
};

export type Contact = {
  primaryPhone: string;
  alternatePhone: string;
  preferredLanguage: PreferredLanguage;
  preferredLanguageOther?: string;
  communicationConsent: boolean;
};

export type LocationCapture = {
  gps: GpsCapture | null;
  manualOverride: boolean;
  manualReason: string | null;
  village: string;
  ward: string;
  municipality: string;
};

export type ProgrammeSource = { id: string; listName: string; reference: string };
export type VulnerabilityNote = {
  category: VulnerabilityCategory;
  detail: string;
  requiresReasonableAccommodation: boolean;
  recordedWithConsent: boolean;
};
export type PrivacyAcknowledgement = {
  noticeVersion: string;
  lawfulBasis: string;
  acknowledgedAt: string;
  signatureEvidenceId: string | null;
  witnessedAlternative: boolean;
  witnessName: string | null;
  witnessIdNumber: string | null;
};
export type IntakeDocumentCategory =
  | "identity" | "proof_of_residence" | "income_evidence" | "prior_benefit_check"
  | "property_check" | "tenure_evidence" | "other";
export type IntakeDocument = {
  id: string;
  category: IntakeDocumentCategory;
  label: string;
  dataUrl: string;
  capturedAt: string;
  sizeBytes: number;
  status: "pending" | "accepted" | "rejected";
  rejectionReason: string | null;
};
export type DuplicateConfidence = "exact" | "high" | "medium" | "low";
export type DuplicateMatch = {
  matchedCaseId: string;
  matchedCaseName: string;
  confidence: DuplicateConfidence;
  matchedOn: string[];
  sourceProject: string;
};
export type DuplicateResolution = "not_duplicate" | "confirmed_separate" | "linked";
export type IntakeStatus =
  | "draft" | "submitted" | "returned" | "approved" | "linked_to_existing" | "cancelled";

export type Intake = {
  id: string;
  status: IntakeStatus;
  duplicateSearchPerformed: boolean;
  duplicateMatches: DuplicateMatch[];
  duplicateResolution: DuplicateResolution | null;
  duplicateResolutionReason: string | null;
  linkedToCaseId: string | null;
  applicantFirstName: string;
  applicantSurname: string;
  idDocumentType: IdDocumentType;
  idNumber: string;
  idFormatStatus: IdFormatStatus;
  idFormatReason: string;
  householdMembers: HouseholdMember[];
  contact: Contact;
  location: LocationCapture;
  tenureType: TenureType;
  currentDwellingType: string;
  programmes: ProgrammeSource[];
  confirmedProgrammeCategory: ProgrammeCategory;
  programmeCategoryNote: string;
  vulnerability: VulnerabilityNote;
  privacy: PrivacyAcknowledgement | null;
  documents: IntakeDocument[];
  capturedBy: string;
  capturedFrom: "applicant" | "spouse_partner" | "representative" | "witness";
  capturedFromName: string;
  startedAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  returnedAt: string | null;
  returnReason: string | null;
  createdCaseId: string | null;
};

/* =========================================================================
   Store root
   ========================================================================= */

export type StoreState = {
  cases: CaseRecord[];
  blockers: Record<string, Blocker[]>;
  activities: Activity[];
  sync: SyncState;
  visits: Visit[];
  persona: Persona;
  seedKind: SeedKind;
  auditLog: AuditEntry[];
  importBatches: ImportBatch[];
  submissionBatches: SubmissionBatch[];
  enrolments: Enrolment[];
  workUnits: WorkUnit[];
  claims: Claim[];
  changeRequests: ChangeRequest[];
  issuedReports: IssuedReport[];
  conflicts: Conflict[];
  handovers: Handover[];
  intakes: Intake[];
  leadImportBatches: LeadImportBatch[];
  beneficiaryLeads: BeneficiaryLead[];
};