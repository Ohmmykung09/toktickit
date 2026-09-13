import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from './AuthGate';
import { StaffWorkspace } from './StaffWorkspace';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const roles = ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'] as const;
type Role = typeof roles[number];
type ManagedUser = { id: number; name: string; email: string; role: Role; isActive: boolean; mustChangePassword: boolean; createdAt: string; updatedAt: string };
type UserForm = { name: string; email: string; role: Role; isActive: boolean; initialPassword: string; confirmPassword: string };
const emptyForm: UserForm = { name: '', email: '', role: 'REQUESTER', isActive: true, initialPassword: '', confirmPassword: '' };

function roleLabel(role: Role) { return role === 'IT_STAFF' ? 'IT Staff' : role === 'ADMINISTRATOR' ? 'Administrator' : 'Requester'; }
async function apiError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return body?.error?.message ?? 'Unable to complete the request.';
}

export function AdminWorkspace() {
  const { authenticatedFetch } = useAuth();
  const [tab, setTab] = useState<'users' | 'queue'>('users');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState('loading'); setMessage('');
    const query = new URLSearchParams();
    if (search.trim()) query.set('search', search.trim());
    if (roleFilter) query.set('role', roleFilter);
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/admin/users?${query}`);
      if (!response.ok) { setMessage(await apiError(response)); setState('error'); return; }
      setUsers(await response.json() as ManagedUser[]); setState('ready');
    } catch { setMessage('Unable to reach TokTickIT. Try again.'); setState('error'); }
  }, [authenticatedFetch, roleFilter, search]);
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function edit(user: ManagedUser) {
    setSelected(user); setMessage('');
    setForm({ name: user.name, email: user.email, role: user.role, isActive: user.isActive, initialPassword: '', confirmPassword: '' });
  }
  function createNew() { setSelected(null); setForm(emptyForm); setMessage(''); }
  function update<K extends keyof UserForm>(key: K, value: UserForm[K]) { setForm((current) => ({ ...current, [key]: value })); }

  async function save(event: FormEvent) {
    event.preventDefault(); setMessage('');
    if (!selected && form.initialPassword !== form.confirmPassword) { setMessage('Initial password and confirmation must match.'); return; }
    setBusy(true);
    const body = selected
      ? { name: form.name, email: form.email, role: form.role, isActive: form.isActive }
      : { name: form.name, email: form.email, role: form.role, isActive: form.isActive, initialPassword: form.initialPassword };
    try {
      const response = await authenticatedFetch(selected ? `${apiBaseUrl}/api/admin/users/${selected.id}` : `${apiBaseUrl}/api/admin/users`, {
        method: selected ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (!response.ok) { setMessage(await apiError(response)); return; }
      const successMessage = selected ? 'User updated.' : 'User created.';
      setSelected(null); setForm(emptyForm); await load(); setMessage(successMessage);
    } catch { setMessage('Unable to reach TokTickIT. Try again.'); }
    finally { setBusy(false); }
  }

  async function resetPassword() {
    if (!selected) return;
    if (form.initialPassword !== form.confirmPassword) { setMessage('Initial password and confirmation must match.'); return; }
    if (!globalThis.confirm(`Set a new initial password for ${selected.name}? Their existing sessions will end.`)) return;
    setBusy(true); setMessage('');
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/admin/users/${selected.id}/initial-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initialPassword: form.initialPassword }) });
      if (!response.ok) { setMessage(await apiError(response)); return; }
      setForm((current) => ({ ...current, initialPassword: '', confirmPassword: '' })); await load(); setMessage('Initial password updated and existing sessions revoked.');
    } catch { setMessage('Unable to reach TokTickIT. Try again.'); }
    finally { setBusy(false); }
  }

  return <main className="admin-page min-vh-100">
    <nav className="admin-nav"><strong>TokTickIT</strong><div><button className={tab === 'queue' ? 'active' : ''} onClick={() => setTab('queue')} type="button">Ticket Queue</button><button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')} type="button">User Management</button></div></nav>
    {tab === 'queue' ? <StaffWorkspace /> : <section className="admin-layout">
      <header className="admin-header"><div><h1>User Management</h1><p>Create accounts, assign one role, and control access.</p></div><button className="btn btn-success" onClick={createNew} type="button">Create user</button></header>
      {message && <div className="alert alert-info" role="status">{message}</div>}
      <form className="admin-filters" onSubmit={(event) => { event.preventDefault(); void load(); }}><label>Search<input aria-label="Search users" onChange={(event) => setSearch(event.target.value)} placeholder="Name or email" value={search} /></label><label>Role<select aria-label="Filter by role" onChange={(event) => setRoleFilter(event.target.value)} value={roleFilter}><option value="">All roles</option>{roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label><button className="btn btn-outline-success" type="submit">Apply</button></form>
      <div className="admin-grid"><section className="admin-list" aria-label="Users">
        {state === 'loading' && <p role="status">Loading users...</p>}
        {state === 'error' && <div role="alert"><p>{message}</p><button className="btn btn-outline-danger" onClick={() => void load()} type="button">Retry</button></div>}
        {state === 'ready' && users.length === 0 && <p>No users match the current filters.</p>}
        {state === 'ready' && users.length > 0 && <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Password</th><th></th></tr></thead><tbody>{users.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.email}</td><td>{roleLabel(item.role)}</td><td>{item.isActive ? 'Active' : 'Inactive'}</td><td>{item.mustChangePassword ? 'Change required' : 'Current'}</td><td><button aria-label={`Edit ${item.name}`} className="btn btn-sm btn-outline-success" onClick={() => edit(item)} type="button">Edit</button></td></tr>)}</tbody></table>}
      </section>
      <aside className="admin-editor"><h2>{selected ? `Edit ${selected.name}` : 'Create user'}</h2><form onSubmit={save}><label>Name<input aria-label="User name" maxLength={100} minLength={2} onChange={(event) => update('name', event.target.value)} required value={form.name} /></label><label>Email<input aria-label="User email" maxLength={254} onChange={(event) => update('email', event.target.value)} required type="email" value={form.email} /></label><label>Role<select aria-label="User role" onChange={(event) => update('role', event.target.value as Role)} value={form.role}>{roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label><label className="admin-check"><input checked={form.isActive} onChange={(event) => update('isActive', event.target.checked)} type="checkbox" /> Active account</label>{!selected && <><label>Initial password<input aria-label="Initial password" minLength={12} onChange={(event) => update('initialPassword', event.target.value)} required type="password" value={form.initialPassword} /></label><label>Confirm initial password<input aria-label="Confirm initial password" minLength={12} onChange={(event) => update('confirmPassword', event.target.value)} required type="password" value={form.confirmPassword} /></label></>}<button aria-label={selected ? 'Submit user changes' : 'Submit create user'} className="btn btn-success" disabled={busy} type="submit">{selected ? 'Save changes' : 'Create user'}</button></form>
        {selected && <section className="password-reset"><h3>Set new initial password</h3><p>This ends existing sessions and requires a password change at next sign-in.</p><label>New initial password<input aria-label="New initial password" minLength={12} onChange={(event) => update('initialPassword', event.target.value)} type="password" value={form.initialPassword} /></label><label>Confirm new initial password<input aria-label="Confirm new initial password" minLength={12} onChange={(event) => update('confirmPassword', event.target.value)} type="password" value={form.confirmPassword} /></label><button className="btn btn-outline-danger btn-sm" disabled={busy || !form.initialPassword} onClick={() => void resetPassword()} type="button">Set initial password</button></section>}
      </aside></div>
    </section>}
  </main>;
}
