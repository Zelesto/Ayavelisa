import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setLoading(false);
    }).catch((sessionError: unknown) => {
      if (!active) return;
      setError(sessionError instanceof Error ? sessionError.message : "Could not check your sign-in session.");
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (_event === "SIGNED_OUT") {
        window.localStorage.removeItem("ayavelisa:field:v2");
        window.localStorage.removeItem("ayavelisa-sync-queue");
      }
      setSession(nextSession);
      setLoading(false);
      setError("");
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) setError(signInError.message);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!supabase) {
    if (import.meta.env.DEV) return <>{children}</>;
    return (
      <main className="auth-page">
        <section className="auth-card">
          <strong>Sign-in is not configured</strong>
          <p>Set the Supabase project URL and publishable key in the deployment environment.</p>
        </section>
      </main>
    );
  }

  if (loading) {
    return <main className="auth-page" role="status"><section className="auth-card">Checking your sign-in…</section></main>;
  }

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-mark"><span>A</span><span>V</span></div>
          <p className="auth-eyebrow">AYAVELISA · DEMO ACCESS</p>
          <h1>Sign in</h1>
          <p>Use an account invited to the Ayavelisa demo workspace.</p>
          <form onSubmit={signIn}>
            <label>
              <span>Email</span>
              <input autoComplete="username" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              <span>Password</span>
              <input autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="button button-primary full-width" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="auth-footnote">Demo data only. Do not enter real beneficiary information.</p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
