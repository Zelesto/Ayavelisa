import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MailPlus, RefreshCw, ShieldCheck, UserRound, UserRoundX } from "lucide-react";
import { SectionEyebrow, StatusPill } from "@/components/ui";
import { authorizedFetch } from "@/lib/supabase";
import { ROLE_LABELS, type AccountRole } from "@/lib/auth";

type ManagedUser = {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
  active: boolean;
  createdAt: string;
};

const roles: AccountRole[] = ["fieldworker", "reviewer", "supervisor", "admin"];

function readableError(code: string | undefined, fallback: string) {
  if (code === "auth_user_already_exists" || code === "account_already_managed") return "This email already has an account. Update its role in the list instead.";
  if (code === "cannot_remove_last_active_admin") return "At least one active administrator must remain.";
  if (code === "cannot_remove_own_admin_access") return "You cannot deactivate or demote your own administrator account.";
  if (code === "invite_sent_account_setup_failed") return "The invitation email was sent, but the account record could not be created. Contact support before inviting this email again.";
  return fallback;
}

export default function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [draftRoles, setDraftRoles] = useState<Record<string, AccountRole>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AccountRole>("fieldworker");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authorizedFetch("/api/admin/users");
      const result = await response.json() as { users?: ManagedUser[]; error?: string };
      if (!response.ok || !result.users) throw new Error(readableError(result.error, "Could not load user accounts."));
      setUsers(result.users);
      setDraftRoles(Object.fromEntries(result.users.map((account) => [account.id, account.role])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load user accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviting(true);
    setError("");
    setNotice("");
    try {
      const response = await authorizedFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, role }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(readableError(result.error, "Could not invite this user."));
      setEmail("");
      setName("");
      setRole("fieldworker");
      setNotice("Invitation sent. The user must accept the email invitation and set their password.");
      await loadUsers();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Could not invite this user.");
    } finally {
      setInviting(false);
    }
  };

  const updateUser = async (account: ManagedUser, update: { role?: AccountRole; active?: boolean }) => {
    setBusyId(account.id);
    setError("");
    setNotice("");
    try {
      const response = await authorizedFetch(`/api/admin/users/${encodeURIComponent(account.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      const result = await response.json() as { user?: ManagedUser; error?: string };
      if (!response.ok || !result.user) throw new Error(readableError(result.error, "Could not update this account."));
      setNotice(`${result.user.email} updated.`);
      await loadUsers();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update this account.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <SectionEyebrow>Administration / Access</SectionEyebrow>
          <h1>Users &amp; roles</h1>
          <p>Invite team members, assign their application role, and deactivate access when it is no longer needed.</p>
        </div>
        <button type="button" className="button button-quiet" onClick={() => void loadUsers()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <section className="panel user-invite-panel">
        <div className="panel-header">
          <div>
            <SectionEyebrow>New account</SectionEyebrow>
            <h2>Invite a team member</h2>
          </div>
          <MailPlus size={19} />
        </div>
        <form className="user-invite-form" onSubmit={invite}>
          <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Name <span className="optional-label">Optional</span><input type="text" autoComplete="name" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Role<select value={role} onChange={(event) => setRole(event.target.value as AccountRole)}>{roles.map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}</select></label>
          <button type="submit" className="button button-primary" disabled={inviting}>
            <MailPlus size={15} />{inviting ? "Sending invite…" : "Send invite"}
          </button>
        </form>
        <p className="user-admin-note">Supabase sends the invitation email. Public sign-ups stay disabled; invited users create their password through the secure email link.</p>
      </section>

      <section className="user-role-guidance" aria-label="Role permissions">
        <p><strong>Fieldworker</strong><span>Visits, intakes and beneficiary leads</span></p>
        <p><strong>Reviewer</strong><span>Review queues, cases, blockers and reports</span></p>
        <p><strong>Supervisor</strong><span>All workspace sections</span></p>
        <p><strong>Administrator</strong><span>All workspace sections plus user and role management</span></p>
      </section>

      {error && <p className="user-admin-message user-admin-error" role="alert">{error}</p>}
      {notice && <p className="user-admin-message user-admin-success" role="status">{notice}</p>}

      <section className="panel user-list-panel">
        <div className="panel-header">
          <div>
            <SectionEyebrow>Managed accounts</SectionEyebrow>
            <h2>Workspace users</h2>
          </div>
          <StatusPill label={`${users.filter((account) => account.active).length} active`} tone="success" />
        </div>
        {loading ? (
          <p className="user-list-empty" role="status">Loading accounts…</p>
        ) : users.length === 0 ? (
          <p className="user-list-empty">No invited users found.</p>
        ) : (
          <div className="user-list">
            {users.map((account) => (
              <div className="user-row" key={account.id}>
                <div className="user-identity">
                  <span className="user-avatar"><UserRound size={17} /></span>
                  <span><strong>{account.name}</strong><small>{account.email}</small></span>
                </div>
                <label className="user-role-select">Role
                  <select
                    value={draftRoles[account.id] ?? account.role}
                    onChange={(event) => setDraftRoles((draft) => ({ ...draft, [account.id]: event.target.value as AccountRole }))}
                    disabled={busyId === account.id}
                    aria-label={`Role for ${account.email}`}
                  >
                    {roles.map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}
                  </select>
                </label>
                <StatusPill label={account.active ? "Active" : "Inactive"} tone={account.active ? "success" : "neutral"} />
                <div className="user-row-actions">
                  {draftRoles[account.id] !== account.role && (
                    <button type="button" className="button button-primary button-small" disabled={busyId === account.id} onClick={() => void updateUser(account, { role: draftRoles[account.id] })}>Save role</button>
                  )}
                  <button
                    type="button"
                    className={account.active ? "button button-quiet button-small" : "button button-primary button-small"}
                    disabled={busyId === account.id}
                    onClick={() => void updateUser(account, { active: !account.active })}
                  >
                    {account.active ? <><UserRoundX size={14} />Deactivate</> : <><ShieldCheck size={14} />Reactivate</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
