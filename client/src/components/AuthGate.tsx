import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { authorizedFetch, supabase } from "@/lib/supabase";
import type { AuthenticatedUser } from "@/lib/auth";

type AuthContextValue = { user: AuthenticatedUser | null; protectedMode: boolean };
const AuthContext = createContext<AuthContextValue>({ user: null, protectedMode: false });

export function useAuth() {
  return useContext(AuthContext);
}

function clearLocalWorkspace() {
  window.localStorage.removeItem("ayavelisa:field:v2");
  window.localStorage.removeItem("ayavelisa-sync-queue");
}

async function readAccountResponse(response: Response): Promise<{ user?: AuthenticatedUser | null; error?: string }> {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`Ayavelisa access service returned an empty response (HTTP ${response.status}). Check the Render deployment and server logs.`);
  }
  try {
    return JSON.parse(body) as { user?: AuthenticatedUser | null; error?: string };
  } catch {
    throw new Error(`Ayavelisa access service returned an unexpected response (HTTP ${response.status}). Confirm the latest server deployment is running.`);
  }
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    if (new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery") {
      setRecoveringPassword(true);
    }

    const resolveSession = async (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      setUser(null);
      if (!nextSession) {
        setError("");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await authorizedFetch("/api/me");
        const result = await readAccountResponse(response);
        if (!response.ok || !result.user) {
          if (result.error === "account_inactive") throw new Error("Your Ayavelisa account is inactive. Ask an administrator to reactivate it.");
          if (result.error === "account_not_invited") throw new Error("This account has not been invited to Ayavelisa. Ask an administrator for access.");
          if (result.error === "account_provisioning_failed") throw new Error("Your admin account could not be created. Check that the account-role database migration has run and inspect the Render logs.");
          if (result.error === "authentication_unavailable") throw new Error("Ayavelisa could not validate your session. Check the Supabase server configuration in Render.");
          if (result.error === "account_role_invalid") throw new Error("Your Ayavelisa role is invalid. Ask an administrator to correct it.");
          if (result.error === "account_email_required") throw new Error("Your Supabase account needs a confirmed email address before Ayavelisa can grant access.");
          throw new Error("Your account could not be authorized for Ayavelisa. Contact an administrator.");
        }
        if (!active) return;
        setUser(result.user);
        setError("");
      } catch (sessionError) {
        if (!active) return;
        setError(sessionError instanceof Error ? sessionError.message : "Could not verify your Ayavelisa account.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }
      void resolveSession(data.session);
    }).catch((sessionError: unknown) => {
      if (!active) return;
      setError(sessionError instanceof Error ? sessionError.message : "Could not check your sign-in session.");
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "INITIAL_SESSION") return;
      if (event === "SIGNED_OUT") clearLocalWorkspace();
      if (event === "PASSWORD_RECOVERY") {
        setRecoveringPassword(true);
        setSession(nextSession);
        setLoading(false);
        return;
      }
      void resolveSession(nextSession);
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

  const signOut = async () => {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(`Could not sign out: ${signOutError.message}`);
  };

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNewPassword("");
      setRecoveringPassword(false);
      setPasswordUpdated(true);
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update your password.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!supabase) {
    if (import.meta.env.DEV) {
      return <AuthContext.Provider value={{ user: null, protectedMode: false }}>{children}</AuthContext.Provider>;
    }
    return (
      <main className="auth-page">
        <section className="auth-card">
          <strong>Sign-in is not configured</strong>
          <p>Set the Supabase project URL and publishable key in the deployment environment.</p>
        </section>
      </main>
    );
  }

  if (recoveringPassword && session) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-mark"><span>A</span><span>V</span></div>
          <p className="auth-eyebrow">AYAVELISA · SECURE ACCOUNT</p>
          <h1>Set a new password</h1>
          <p>Choose a new password for your account.</p>
          <form onSubmit={updatePassword}>
            <label>
              <span>New password</span>
              <input autoComplete="new-password" type="password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="button button-primary full-width" disabled={submitting}>
              {submitting ? "Updating password…" : "Update password"}
            </button>
          </form>
          <p className="auth-footnote">Use at least 8 characters and don’t reuse a password from another site.</p>
        </section>
      </main>
    );
  }

  if (loading) {
    return <main className="auth-page" role="status"><section className="auth-card">Checking your sign-in…</section></main>;
  }

  if (recoveringPassword) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-mark"><span>A</span><span>V</span></div>
          <p className="auth-eyebrow">AYAVELISA · SECURE ACCOUNT</p>
          <h1>Recovery link unavailable</h1>
          <p>This password-reset link may have expired or already been used. Ask an administrator to send a new one.</p>
          <button type="button" className="button button-primary full-width" onClick={() => setRecoveringPassword(false)}>Back to sign in</button>
        </section>
      </main>
    );
  }

  if (!session || !user) {
    return (
      <AuthContext.Provider value={{ user: null, protectedMode: true }}>
        <main className="auth-page">
          <section className="auth-card">
            <div className="brand-mark"><span>A</span><span>V</span></div>
            <p className="auth-eyebrow">AYAVELISA · PROTECTED ACCESS</p>
            <h1>{session ? "Account access needed" : "Sign in"}</h1>
            {passwordUpdated && <p className="user-admin-message user-admin-success" role="status">Password updated. Sign in with your new password.</p>}
            <p>{session ? "Your Supabase sign-in is valid, but this account does not currently have an active Ayavelisa role." : "Use an account invited to the Ayavelisa workspace."}</p>
            {!session && (
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
            )}
            {session && (
              <>
                {error && <p className="auth-error" role="alert">{error}</p>}
                <button type="button" className="button button-primary full-width" onClick={() => void signOut()}>Sign out</button>
              </>
            )}
            <p className="auth-footnote">Demo data only. Do not enter real beneficiary information.</p>
          </section>
        </main>
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={{ user, protectedMode: true }}>{children}</AuthContext.Provider>;
}
