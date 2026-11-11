import type { CaseRecord, StoreState, Visit, VisitForm } from "./types";
import { seedVisitForm } from "./visitForm";

const TODAY = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const dstr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const atTime = (h: number, m: number) => { const d = new Date(TODAY); d.setHours(h, m, 0, 0); return d.toISOString(); };
const FW_NAME = "Lindiwe Ndlovu";
const SUP_NAME = "Thandi Ndlovu";

const BASE_CASES: CaseRecord[] = [
  { id: "AY-2026-0118", name: "Noluthando Mbeki", household: "Mbeki household", project: "Ndlovu Extension Phase 2", location: "Ward 14 Â· Mthatha", source: "Municipal source list", verification: "Internally verified", verificationTone: "success", subsidy: "Awaiting department", subsidyTone: "warning", readiness: "Blocked Â· 2 gates", nextAction: "Upload missing proof of residence", updated: "Today, 09:42", members: 5, site: "Plot ND-0142" },
  { id: "AY-2026-0109", name: "Siyabonga Dlamini", household: "Dlamini household", project: "Ndlovu Extension Phase 2", location: "Ward 14 Â· Mthatha", source: "Field intake", verification: "Awaiting review", verificationTone: "warning", subsidy: "Draft pack", subsidyTone: "neutral", readiness: "Not started", nextAction: "Supervisor review", updated: "Yesterday, 15:18", members: 3, site: "Unallocated" },
  { id: "AY-2026-0097", name: "Lwazi Nqoko", household: "Nqoko household", project: "Mbashe Rural Housing", location: "Village 6 Â· Dutywa", source: "Disaster register", verification: "Unresolved classification", verificationTone: "danger", subsidy: "Not started", subsidyTone: "neutral", readiness: "Exception", nextAction: "Resolve source overlap", updated: "11 Nov 2026", members: 6, site: "Provisional MB-062" },
  { id: "AY-2026-0084", name: "Zimasa Qwabe", household: "Qwabe household", project: "Mbashe Rural Housing", location: "Village 2 Â· Dutywa", source: "Approved register", verification: "Internally verified", verificationTone: "success", subsidy: "Officially approved", subsidyTone: "success", readiness: "Ready for works", nextAction: "Confirm builder pack", updated: "10 Nov 2026", members: 4, site: "Plot MB-0207" },
  { id: "AY-2026-0078", name: "Aphiwe Jacobs", household: "Jacobs household", project: "Ndlovu Extension Phase 2", location: "Ward 12 Â· Mthatha", source: "Replacement list", verification: "Returned for correction", verificationTone: "warning", subsidy: "Query from department", subsidyTone: "danger", readiness: "Blocked Â· 1 gate", nextAction: "Respond to official query", updated: "09 Nov 2026", members: 2, site: "Plot ND-0119" },
];
const EXTRA_CASES: CaseRecord[] = [
  { id: "AY-2026-0134", name: "Bongani Maqashalala", household: "Maqashalala household", project: "Ndlovu Extension Phase 2", location: "Ward 14 Â· Mthatha", source: "Municipal source list", verification: "Awaiting review", verificationTone: "warning", subsidy: "Not started", subsidyTone: "neutral", readiness: "Not started", nextAction: "Field verification", updated: "Today, 06:00", members: 4, site: "Plot ND-0151" },
  { id: "AY-2026-0135", name: "Nosipho Fihla", household: "Fihla household", project: "Ndlovu Extension Phase 2", location: "Ward 14 Â· Mthatha", source: "Field intake", verification: "Awaiting review", verificationTone: "warning", subsidy: "Not started", subsidyTone: "neutral", readiness: "Not started", nextAction: "Field verification", updated: "Today, 06:00", members: 3, site: "Plot ND-0152" },
  { id: "AY-2026-0136", name: "Thembinkosi Nyawuza", household: "Nyawuza household", project: "Mbashe Rural Housing", location: "Village 4 Â· Dutywa", source: "Approved register", verification: "Awaiting review", verificationTone: "warning", subsidy: "Not started", subsidyTone: "neutral", readiness: "Not started", nextAction: "Field verification", updated: "Today, 06:00", members: 5, site: "Plot MB-0231" },
];
const T = [atTime(8,0),atTime(8,45),atTime(9,30),atTime(10,30),atTime(11,15),atTime(13,0),atTime(14,0),atTime(15,0)];
function mkV(id: string, caseId: string, sf: string, o: Partial<Visit> = {}): Visit {
  return { id, caseId, assignedTo: FW_NAME, scheduledFor: sf, status: "assigned", form: null, evidence: [], startedAt: null, submittedAt: null, reviewedAt: null, returnedAt: null, returnReason: null, reviewedBy: null, synced: false, ...o };
}
function filledForm(): VisitForm {
  return seedVisitForm({
    arrivalConfirmed: true,
    workerDeclaration: true,
    visitType: "initial",
    gps: { lat: -31.5889, lng: 28.7844, accuracyM: 8, capturedAt: atTime(8, 5), source: "device" },
    villageObserved: "Ward 14",
    wardObserved: "Ward 14",
    municipalityObserved: "Mthatha",
    identityType: "South African ID",
    identityNumber: "0000000000000",
    identityVerified: true,
    householdMembers: [
      { id: "seed-mbr-1", declaredMemberId: null, fullName: "Noluthando Mbeki", relationship: "head", dateOfBirth: null, present: true, note: "" },
      { id: "seed-mbr-2", declaredMemberId: null, fullName: "Household member 2", relationship: "child", dateOfBirth: null, present: true, note: "" },
      { id: "seed-mbr-3", declaredMemberId: null, fullName: "Household member 3", relationship: "child", dateOfBirth: null, present: true, note: "" },
      { id: "seed-mbr-4", declaredMemberId: null, fullName: "Household member 4", relationship: "child", dateOfBirth: null, present: true, note: "" },
      { id: "seed-mbr-5", declaredMemberId: null, fullName: "Household member 5", relationship: "child", dateOfBirth: null, present: true, note: "" },
    ],
    householdObserved: 5,
    primaryPhone: "+27 71 000 0000",
    dwellingCondition: "Informal structure.",
    programmeSourceListName: "Municipal source list",
    programmeReference: "MUN-2026-0118",
    programmeSourceConfirmed: true,
    priorAssistanceChecked: true,
    priorAssistanceStatus: "none",
    proofOfResidenceStatus: "captured",
    outcome: "verified",
    fieldworkerName: FW_NAME,
    notes: "",
  });
}
const V_FRESH: Visit[] = [
  mkV("V-2026-1101","AY-2026-0118",T[0]), mkV("V-2026-1102","AY-2026-0109",T[1]), mkV("V-2026-1103","AY-2026-0097",T[2]), mkV("V-2026-1104","AY-2026-0134",T[3]),
  mkV("V-2026-1105","AY-2026-0135",T[4]), mkV("V-2026-1106","AY-2026-0136",T[5]), mkV("V-2026-1107","AY-2026-0078",T[6]), mkV("V-2026-1108","AY-2026-0084",T[7]),
];
const V_MID: Visit[] = [
  mkV("V-2026-1101","AY-2026-0118",T[0],{status:"approved",form:filledForm(),startedAt:atTime(8,5),submittedAt:atTime(8,40),reviewedAt:atTime(9,0),reviewedBy:SUP_NAME,synced:true}),
  mkV("V-2026-1102","AY-2026-0109",T[1],{status:"approved",form:filledForm(),startedAt:atTime(8,55),submittedAt:atTime(9,25),reviewedAt:atTime(9,45),reviewedBy:SUP_NAME,synced:true}),
  mkV("V-2026-1103","AY-2026-0097",T[2],{status:"captured",form:filledForm(),startedAt:atTime(9,40),submittedAt:atTime(10,15),synced:true}),
  mkV("V-2026-1104","AY-2026-0134",T[3],{status:"returned",form:{...filledForm(),identityVerified:false},startedAt:atTime(10,35),submittedAt:atTime(11,0),reviewedAt:atTime(11,30),returnedAt:atTime(11,30),reviewedBy:SUP_NAME,synced:true,returnReason:"Identity evidence photo is not legible. Please recapture and resubmit."}),
  mkV("V-2026-1105","AY-2026-0135",T[4]), mkV("V-2026-1106","AY-2026-0136",T[5]), mkV("V-2026-1107","AY-2026-0078",T[6]), mkV("V-2026-1108","AY-2026-0084",T[7]),
];
const V_END: Visit[] = V_FRESH.map((v,i) => i === 7 ? v : { ...v, status: "captured" as const, form: filledForm(), startedAt: atTime(8+i,5), submittedAt: atTime(8+i,35), synced: i < 5 });

const EMPTY_UAT = { auditLog: [], importBatches: [], submissionBatches: [], enrolments: [], workUnits: [], claims: [], changeRequests: [], issuedReports: [], conflicts: [], handovers: [], leadImportBatches: [], beneficiaryLeads: [] };

function base(kind: StoreState["seedKind"]): StoreState {
  return { cases: [], blockers: {}, activities: [], sync: { pendingUploads: 0, lastSync: null, runs: 0 }, visits: [], persona: "fieldworker", seedKind: kind, intakes: [], ...EMPTY_UAT };
}

export function seedFor(kind: StoreState["seedKind"]): StoreState {
  const all = [...BASE_CASES, ...EXTRA_CASES].map(c => ({ ...c }));
  const acts = [
    { id: "a1", kind: "visit" as const, tone: "sage" as const, title: "Visit approved", detail: "AY-2026-0118 Â· Noluthando Mbeki", time: "09:00", at: atTime(9, 0) },
    { id: "a2", kind: "visit" as const, tone: "blue" as const, title: "Visit submitted for review", detail: "AY-2026-0097 Â· Lwazi Nqoko", time: "10:15", at: atTime(10, 15) },
    { id: "a3", kind: "gate" as const, tone: "coral" as const, title: "Visit returned", detail: "AY-2026-0134 Â· legibility", time: "11:30", at: atTime(11, 30) },
  ];
  const leadImportBatches = [
    { id: "LB-2026-001", batchRef: "DEP-2026-001", project: "Ndlovu Extension Phase 2", programme: "Housing programme", sourceFileName: "departmental_leads_nov.xlsx", importingUser: "Thandi Ndlovu", importedAt: atTime(8, 12), rowCount: 128, acceptedCount: 124, rejectedCount: 2, duplicateCount: 2, columnMapping: { IDNo: "idNo", Surname: "surname", "Full Names": "fullNames", Status: "sourceStatus", Subsidy: "subsidy", "PHB Date": "phbDate", "Site No": "siteNo", Township: "township" }, fileType: "xlsx" as const, retentionRef: "retention/DEP-2026-001.pdf" },
    { id: "LB-2026-002", batchRef: "DEP-2026-002", project: "Mbashe Rural Housing", programme: "Rural subsidy access", sourceFileName: "mbashe_rural_approved.csv", importingUser: "Sipho Mahlangu", importedAt: atTime(9, 48), rowCount: 63, acceptedCount: 58, rejectedCount: 3, duplicateCount: 2, columnMapping: { IDNo: "idNo", Surname: "surname", "Full Names": "fullNames", Status: "sourceStatus", Subsidy: "subsidy", "PHB Date": "phbDate", "Site No": "siteNo", Township: "township" }, fileType: "csv" as const, retentionRef: "retention/DEP-2026-002.pdf" },
  ];
  const beneficiaryLeads = [
    { id: "BL-001", leadRef: "BL-2026-001", batchRef: "DEP-2026-001", project: "Ndlovu Extension Phase 2", programme: "Housing programme", sourceStatus: "Approved" as const, leadStatus: "Assigned" as const, assignedTo: "Lindiwe Ndlovu", surname: "Mbeki", fullNames: "Noluthando Mbeki", idNo: "0000000000000", siteNo: "ND-0142", township: "Ward 14", sourceData: { IDNo: "0000000000000", Surname: "Mbeki", "Full Names": "Noluthando Mbeki", Status: "Approved", Subsidy: "R 0", "PHB Date": "2026-11-05", "Site No": "ND-0142", Township: "Ward 14" }, createdAt: atTime(8, 15), lastUpdatedAt: atTime(9, 40), linkedEnquiryId: "ENQ-1021", visitHistory: ["Assigned", "Visit complete"], duplicateFlag: false },
    { id: "BL-002", leadRef: "BL-2026-002", batchRef: "DEP-2026-001", project: "Ndlovu Extension Phase 2", programme: "Housing programme", sourceStatus: "Received" as const, leadStatus: "Visit pending" as const, assignedTo: "Lindiwe Ndlovu", surname: "Dlamini", fullNames: "Siyabonga Dlamini", idNo: "9808155233086", siteNo: "ND-0151", township: "Ward 14", sourceData: { IDNo: "9808155233086", Surname: "Dlamini", "Full Names": "Siyabonga Dlamini", Status: "Received", Subsidy: "R 0", "PHB Date": "2026-11-03", "Site No": "ND-0151", Township: "Ward 14" }, createdAt: atTime(8, 25), lastUpdatedAt: atTime(10, 20), linkedEnquiryId: null, visitHistory: ["Assigned"], duplicateFlag: true },
    { id: "BL-003", leadRef: "BL-2026-003", batchRef: "DEP-2026-002", project: "Mbashe Rural Housing", programme: "Rural subsidy access", sourceStatus: "Failed searches" as const, leadStatus: "Survey in progress" as const, assignedTo: "Lindiwe Ndlovu", surname: "Qwabe", fullNames: "Zimasa Qwabe", idNo: "9004015109080", siteNo: "MB-0207", township: "Village 2", sourceData: { IDNo: "9004015109080", Surname: "Qwabe", "Full Names": "Zimasa Qwabe", Status: "Failed searches", Subsidy: "R 0", "PHB Date": "2026-10-12", "Site No": "MB-0207", Township: "Village 2" }, createdAt: atTime(9, 55), lastUpdatedAt: atTime(11, 10), linkedEnquiryId: "ENQ-2056", visitHistory: ["Assigned", "Survey submitted"], duplicateFlag: false },
  ];
  switch (kind) {
    case "empty": return { ...base("empty"), leadImportBatches, beneficiaryLeads };
    case "portfolio": return { ...base("portfolio"), cases: all, blockers: { "AY-2026-0118": [ {id:"B1",label:"Proof of residence is missing",detail:"Required by checklist",action:"Upload proof of residence",primary:"request",status:"open"}, {id:"B2",label:"Geotechnical suitability not recorded",detail:"Site evidence required",action:"Assign geotechnical survey",primary:"assign",status:"open"} ] }, activities: acts, sync: { pendingUploads: 3, lastSync: null, runs: 0 }, persona: "supervisor", leadImportBatches, beneficiaryLeads };
    case "fresh_day": return { ...base("fresh_day"), cases: all, activities: [{ id: "s1", kind: "intake", tone: "sand", title: "Day started", detail: "8 assignments loaded", time: "06:00", at: atTime(6, 0) }], visits: V_FRESH, leadImportBatches, beneficiaryLeads };
    case "mid_day": return { ...base("mid_day"), cases: all, activities: acts, sync: { pendingUploads: 1, lastSync: atTime(10, 20), runs: 2 }, visits: V_MID, leadImportBatches, beneficiaryLeads };
    case "end_of_day": return { ...base("end_of_day"), cases: all, activities: acts, sync: { pendingUploads: 3, lastSync: atTime(11, 0), runs: 3 }, visits: V_END, leadImportBatches, beneficiaryLeads };
    case "returned_visit": return { ...base("returned_visit"), cases: all, activities: acts, sync: { pendingUploads: 0, lastSync: atTime(12, 0), runs: 1 }, visits: V_MID, leadImportBatches, beneficiaryLeads };
  }
}

export const SEED_LABELS: Record<StoreState["seedKind"], { label: string; detail: string }> = {
  empty: { label: "Empty", detail: "Start with no visits and no cases" },
  fresh_day: { label: "Fresh day", detail: "8 assigned visits, none started" },
  mid_day: { label: "Mid-day", detail: "2 approved, 1 captured, 1 returned, 4 assigned" },
  end_of_day: { label: "End of day", detail: "7 submitted, 1 outstanding, sync queue full" },
  returned_visit: { label: "Returned visit", detail: "One visit returned by supervisor, needs rework" },
  portfolio: { label: "Portfolio", detail: "The supervisor dashboard view" },
};

export const TODAY_STR = dstr(TODAY);