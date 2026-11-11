import { downloadCsv, toCsv } from "./csv";
import type { CaseRecord, Visit } from "./types";

export type ExportFormat = "xlsx" | "pdf" | "csv";

function rowsFor(cases: CaseRecord[]) {
  return cases.map((item) => {
    const latestCheck = item.verifyNowChecks?.at(-1);
    return {
      Reference: item.id,
      Applicant: item.name,
      Household: item.household,
      Project: item.project,
      Location: item.location,
      Members: item.members,
      Source: item.source,
      Verification: item.verification,
      "VerifyNow status": latestCheck?.status ?? "Not run",
      "VerifyNow outcome": latestCheck?.outcome ?? "Not run",
      "VerifyNow note": latestCheck?.summary ?? "",
      "Subsidy status": item.subsidy,
      Readiness: item.readiness,
      "Next action": item.nextAction,
      Assigned: item.assignedTo ?? "",
      Site: item.site,
      Updated: item.updated,
    };
  });
}

export async function exportCases(cases: CaseRecord[], format: ExportFormat, filename: string) {
  const rows = rowsFor(cases);
  if (format === "csv") {
    const columns = Object.keys(rows[0] ?? {}).map((key) => ({ key, label: key }));
    downloadCsv(`${filename}.csv`, toCsv(rows, columns));
    return;
  }
  if (format === "xlsx") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Cases");
    XLSX.writeFile(workbook, `${filename}.xlsx`);
    return;
  }
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape" });
  pdf.setFontSize(15);
  pdf.text("Ayavelisa beneficiary case report", 14, 16);
  pdf.setFontSize(8);
  pdf.text(`Generated ${new Date().toLocaleString()} · ${cases.length} case(s)`, 14, 23);
  let y = 33;
  for (const row of rows) {
    if (y > 185) {
      pdf.addPage();
      y = 15;
    }
    const text = `${row.Reference} | ${row.Applicant} | ${row.Project} | ${row.Location} | ${row.Verification} | ${row.Readiness}`;
    const lines = pdf.splitTextToSize(text, 265) as string[];
    pdf.text(lines, 14, y);
    y += lines.length * 4 + 3;
  }
  pdf.save(`${filename}.pdf`);
}

export async function exportDepartmentPacket(item: CaseRecord, visits: Visit[], format: ExportFormat) {
  const matchingVisits = visits.filter((visit) => visit.caseId === item.id);
  const filename = `ayavelisa-department-packet-${item.id}`;
  if (format !== "pdf") {
    await exportCases([item], format, filename);
    return;
  }

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  const latestCheck = item.verifyNowChecks?.at(-1);
  const lines = [
    "DEPARTMENT HANDOFF PACKET — DRAFT",
    `Reference: ${item.id}`,
    `Applicant: ${item.name}`,
    `Household: ${item.household} (${item.members} members)`,
    `Project: ${item.project}`,
    `Location: ${item.location}`,
    `Source: ${item.source}`,
    `Verification: ${item.verification}`,
    `VerifyNow: ${latestCheck?.status ?? "Not run"} — ${latestCheck?.summary ?? "No check recorded"}`,
    `Subsidy: ${item.subsidy}`,
    `Readiness: ${item.readiness}`,
    `Next action: ${item.nextAction}`,
    `Site: ${item.site}`,
    "",
    "VISIT HISTORY",
    ...matchingVisits.map((visit) => `${visit.id} · ${visit.status.replaceAll("_", " ")} · ${visit.submittedAt ? new Date(visit.submittedAt).toLocaleString() : "not submitted"}`),
    "",
    "This file is a draft export only. It has not been submitted to a department. VerifyNow is not configured unless a real provider response is recorded.",
  ];
  let y = 18;
  for (const line of lines) {
    const wrapped = pdf.splitTextToSize(line, 180) as string[];
    if (y + wrapped.length * 6 > 280) {
      pdf.addPage();
      y = 18;
    }
    pdf.text(wrapped, 14, y);
    y += wrapped.length * 6 + 2;
  }
  pdf.save(`${filename}.pdf`);
}
