import type { Persona } from "./types";

export type AccountRole = "admin" | "fieldworker" | "supervisor" | "reviewer";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
};

export const ROLE_LABELS: Record<AccountRole, string> = {
  admin: "Administrator",
  fieldworker: "Fieldworker",
  supervisor: "Supervisor",
  reviewer: "Reviewer",
};

export function rolePersona(role: AccountRole): Persona {
  return role === "fieldworker" ? "fieldworker" : role === "reviewer" ? "reviewer" : "supervisor";
}

export function userInitials(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  return (words[0] ?? email).slice(0, 2).toUpperCase();
}
