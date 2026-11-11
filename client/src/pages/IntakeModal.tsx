import { useEffect, useRef } from "react";
import { navigate } from "@/lib/router";

/**
 * Legacy shim — "New intake" now routes to the full wizard at /intake.
 * Does not call onSaved: no record exists yet, and a placeholder id
 * (e.g. "new-intake") would send callers to /cases/new-intake.
 */
export default function IntakeModal({
  onClose,
}: {
  onClose: () => void;
  /** Kept for API compatibility with the previous modal; not invoked. */
  onSaved?: (id: string) => void;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    onCloseRef.current?.();
    // `replace` (if supported) so Back doesn't return to the dead modal state.
    navigate("/intake", { replace: true });
  }, []);

  return null;
}