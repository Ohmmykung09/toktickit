import {
  createContext,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export type PublicUser = {
  id: number;
  name: string;
  email: string;
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
};

export type AuthPayload = {
  user: PublicUser;
  mustChangePassword: boolean;
  csrfToken: string;
};

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; payload: AuthPayload };

type AuthContextValue = {
  user: PublicUser;
  csrfToken: string;
  authenticatedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an authenticated session.');
  return context;
}

export function AuthenticatedProvider({ payload, children }: { payload: AuthPayload; children: ReactNode }) {
  const authenticatedFetch = useCallback((input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (!['GET', 'HEAD', 'OPTIONS'].includes((init.method ?? 'GET').toUpperCase())) {
      headers.set('X-CSRF-Token', payload.csrfToken);
    }
    return fetch(input, { ...init, credentials: 'include', headers });
  }, [payload.csrfToken]);
  const value = useMemo(() => ({
    user: payload.user,
    csrfToken: payload.csrfToken,
    authenticatedFetch
  }), [authenticatedFetch, payload.csrfToken, payload.user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function authErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? 'Unable to complete the request.';
  } catch {
    return 'Unable to complete the request.';
  }
}

function roleLabel(role: PublicUser['role']) {
  return role
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function Login({ onAuthenticated }: { onAuthenticated: (payload: AuthPayload) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        setError(await authErrorMessage(response));
        return;
      }
      onAuthenticated((await response.json()) as AuthPayload);
    } catch {
      setError('Unable to reach TokTickIT. Check the backend and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="login-title">
        <span className="auth-brand">TokTickIT</span>
        <h1 id="login-title">Sign in</h1>
        <p className="text-secondary">Use your service desk account to continue.</p>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <label className="form-label fw-semibold" htmlFor="login-email">Email</label>
          <input
            autoComplete="username"
            className="form-control"
            id="login-email"
            maxLength={254}
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <label className="form-label fw-semibold mt-3" htmlFor="login-password">Password</label>
          <input
            autoComplete="current-password"
            className="form-control"
            id="login-password"
            maxLength={128}
            minLength={12}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <button className="btn btn-success mt-4 w-100" disabled={busy} type="submit">
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}

function ChangePassword({ payload, onChanged }: {
  payload: AuthPayload;
  onChanged: (payload: AuthPayload) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation must match.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/change-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': payload.csrfToken },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      if (!response.ok) {
        setError(await authErrorMessage(response));
        return;
      }
      onChanged((await response.json()) as AuthPayload);
    } catch {
      setError('Unable to change the password. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="change-password-title">
        <span className="auth-brand">TokTickIT</span>
        <h1 id="change-password-title">Change initial password</h1>
        <p className="text-secondary">Welcome, {payload.user.name}. Create a private password before continuing.</p>
        <p className="auth-policy">Use 12-128 characters and at least three of uppercase, lowercase, number, and symbol.</p>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <label className="form-label fw-semibold" htmlFor="current-password">Current password</label>
          <input className="form-control" id="current-password" maxLength={128} minLength={12} onChange={(event) => setCurrentPassword(event.target.value)} required type="password" value={currentPassword} />
          <label className="form-label fw-semibold mt-3" htmlFor="new-password">New password</label>
          <input autoComplete="new-password" className="form-control" id="new-password" maxLength={128} minLength={12} onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} />
          <label className="form-label fw-semibold mt-3" htmlFor="confirm-password">Confirm new password</label>
          <input autoComplete="new-password" className="form-control" id="confirm-password" maxLength={128} minLength={12} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} />
          <button className="btn btn-success mt-4 w-100" disabled={busy} type="submit">{busy ? 'Changing password...' : 'Change password'}</button>
        </form>
      </section>
    </main>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/auth/me`, { credentials: 'include' });
        if (!active) return;
        setState(response.ok
          ? { status: 'signed-in', payload: (await response.json()) as AuthPayload }
          : { status: 'signed-out' });
      } catch {
        if (active) setState({ status: 'signed-out' });
      }
    }
    void restoreSession();
    return () => { active = false; };
  }, []);

  if (state.status === 'loading') {
    return <main className="auth-page"><p role="status">Checking your session...</p></main>;
  }
  if (state.status === 'signed-out') {
    return <Login onAuthenticated={(payload) => setState({ status: 'signed-in', payload })} />;
  }
  if (state.payload.mustChangePassword) {
    return <ChangePassword payload={state.payload} onChanged={(payload) => setState({ status: 'signed-in', payload })} />;
  }
  const payload = state.payload;

  async function signOut() {
    await fetch(`${apiBaseUrl}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': payload.csrfToken }
    }).catch(() => undefined);
    setState({ status: 'signed-out' });
  }

  return (
    <AuthenticatedProvider payload={payload}>
      <div className="authenticated-shell">
        <div className="auth-userbar">
          <div><strong>{payload.user.name}</strong><span>{roleLabel(payload.user.role)}</span></div>
          <button className="btn btn-outline-success btn-sm" onClick={signOut} type="button">Log out</button>
        </div>
        {children}
      </div>
    </AuthenticatedProvider>
  );
}
