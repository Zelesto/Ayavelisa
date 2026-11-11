import { useEffect, useState } from "react";
import type { VisitForm } from "./types";

export type SaveState = "idle" | "saving" | "error";

const DEBOUNCE_MS = 800;

export function useVisitDraft(
  visitId: string,
  form: VisitForm | null,
  saveForm: (id: string, value: VisitForm) => void,
) {
  const [state, setState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!visitId || !form) return;
    const timer = window.setTimeout(() => {
      setState("saving");
      try {
        saveForm(visitId, form);
        setLastSavedAt(new Date());
        setState("idle");
      } catch {
        setState("error");
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [visitId, form, saveForm]);

  return { state, lastSavedAt };
}
