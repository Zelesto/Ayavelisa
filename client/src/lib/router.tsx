import { useEffect, useState } from "react";

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const current = window.location.pathname + window.location.search;
  if (to === current) return;
  if (opts.replace) window.history.replaceState({}, "", to);
  else window.history.pushState({}, "", to);
  emit();
}

export function useRoute() {
  const read = () => ({
    path: window.location.pathname,
    search: window.location.search,
  });
  const [route, setRoute] = useState(read);

  useEffect(() => {
    const update = () => setRoute(read());
    listeners.add(update);
    window.addEventListener("popstate", update);
    return () => {
      listeners.delete(update);
      window.removeEventListener("popstate", update);
    };
  }, []);

  return route;
}

export function useSearchParams() {
  const { search } = useRoute();
  return new URLSearchParams(search);
}