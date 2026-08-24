import { useEffect, useState, type FormEvent } from 'react';

type Requester = { id: number; name: string };
type Lookup = { id: number; name: string };
type Category = Lookup;
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type HealthStatus = 'idle' | 'loading' | 'online' | 'offline';
type RequesterLoadState = 'loading' | 'ready' | 'empty' | 'error';
type View = 'tickets' | 'create';

type TicketForm = {
  categoryId: string;
  relatedSystemId: string;
  summary: string;
  requestedPriority: Priority;
  description: string;
};

type TicketResponse = {
  ticketNumber: string;
  status: string;
  createdAt: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

const initialTicketForm: TicketForm = {
  categoryId: '',
  relatedSystemId: '',
  summary: '',
  requestedPriority: 'MEDIUM',
  description: ''
};

function idempotencyKey() {
  return globalThis.crypto.randomUUID();
}

function validateTicketForm(form: TicketForm) {
  const errors: Partial<Record<keyof TicketForm, string>> = {};
  const summaryLength = form.summary.trim().length;
  const descriptionLength = form.description.trim().length;

  if (!form.categoryId) errors.categoryId = 'Choose a category.';
  if (!form.relatedSystemId) errors.relatedSystemId = 'Choose a related system.';
  if (summaryLength < 5 || summaryLength > 120) {
    errors.summary = 'Ticket Summary must contain 5 to 120 characters.';
  }
  if (descriptionLength < 10 || descriptionLength > 2000) {
    errors.description = 'Description must contain 10 to 2,000 characters.';
  }

  return errors;
}

function CreateTicketForm({ requester }: { requester: Requester }) {
  const [categories, setCategories] = useState<Lookup[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<Lookup[]>([]);
  const [lookupState, setLookupState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [form, setForm] = useState<TicketForm>(initialTicketForm);
  const [errors, setErrors] = useState<Partial<Record<keyof TicketForm, string>>>({});
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'error' | 'success'>('idle');
  const [submitError, setSubmitError] = useState('');
  const [createdTicket, setCreatedTicket] = useState<TicketResponse | null>(null);
  const [requestKey, setRequestKey] = useState('');

  useEffect(() => {
    async function loadLookups() {
      try {
        const [categoryResponse, relatedSystemResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/categories`),
          fetch(`${apiBaseUrl}/api/related-systems`)
        ]);

        if (!categoryResponse.ok || !relatedSystemResponse.ok) throw new Error();
        setCategories((await categoryResponse.json()) as Lookup[]);
        setRelatedSystems((await relatedSystemResponse.json()) as Lookup[]);
        setLookupState('ready');
      } catch {
        setLookupState('error');
      }
    }

    void loadLookups();
  }, []);

  function updateForm<K extends keyof TicketForm>(field: K, value: TicketForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateTicketForm(form);
    setErrors(validationErrors);
    setSubmitError('');

    if (Object.keys(validationErrors).length > 0) return;

    const key = requestKey || idempotencyKey();
    setRequestKey(key);
    setSubmitState('submitting');

    try {
      const response = await fetch(`${apiBaseUrl}/api/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Development-Requester-Id': String(requester.id),
          'Idempotency-Key': key
        },
        body: JSON.stringify({
          categoryId: Number(form.categoryId),
          relatedSystemId: Number(form.relatedSystemId),
          summary: form.summary,
          requestedPriority: form.requestedPriority,
          description: form.description
        })
      });
      const payload = (await response.json()) as Partial<TicketResponse> & { error?: string };

      if (!response.ok || !payload.ticketNumber || !payload.status || !payload.createdAt) {
        throw new Error(payload.error ?? 'Unable to create the ticket. Please try again.');
      }

      setCreatedTicket(payload as TicketResponse);
      setSubmitState('success');
      setRequestKey('');
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Unable to create the ticket. Please try again.'
      );
      setSubmitState('error');
    }
  }

  if (lookupState === 'loading') return <p role="status">Loading ticket form data...</p>;
  if (lookupState === 'error') {
    return <div className="alert alert-danger" role="alert">Unable to load ticket form data. Check the backend and try again.</div>;
  }

  return (
    <section className="ticket-form-panel">
      <div className="d-flex flex-wrap justify-content-between gap-2 mb-4">
        <div>
          <h1 className="h3 mb-1">Create Ticket</h1>
          <p className="text-secondary mb-0">Submit an IT support request for {requester.name}.</p>
        </div>
        <span className="badge text-bg-light align-self-start">Status will be New</span>
      </div>

      {createdTicket && <div className="alert alert-success" role="status"><strong>Ticket created successfully.</strong><p className="mb-0">Ticket Number: {createdTicket.ticketNumber} | Status: {createdTicket.status}</p></div>}
      {submitState === 'error' && <div className="alert alert-danger" role="alert">{submitError}</div>}

      <form noValidate onSubmit={submitTicket}>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label fw-semibold" htmlFor="category">Category <span aria-hidden="true" className="text-danger">*</span></label>
            <select aria-describedby={errors.categoryId ? 'category-error' : undefined} className={`form-select ${errors.categoryId ? 'is-invalid' : ''}`} id="category" onChange={(event) => updateForm('categoryId', event.target.value)} value={form.categoryId}>
              <option value="">Choose a category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            {errors.categoryId && <div className="invalid-feedback" id="category-error">{errors.categoryId}</div>}
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold" htmlFor="related-system">Related System <span aria-hidden="true" className="text-danger">*</span></label>
            <select aria-describedby={errors.relatedSystemId ? 'related-system-error' : undefined} className={`form-select ${errors.relatedSystemId ? 'is-invalid' : ''}`} id="related-system" onChange={(event) => updateForm('relatedSystemId', event.target.value)} value={form.relatedSystemId}>
              <option value="">Choose a related system</option>
              {relatedSystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
            </select>
            {errors.relatedSystemId && <div className="invalid-feedback" id="related-system-error">{errors.relatedSystemId}</div>}
          </div>
          <div className="col-md-8">
            <label className="form-label fw-semibold" htmlFor="summary">Ticket Summary <span aria-hidden="true" className="text-danger">*</span></label>
            <input aria-describedby={errors.summary ? 'summary-error' : undefined} className={`form-control ${errors.summary ? 'is-invalid' : ''}`} id="summary" maxLength={120} onChange={(event) => updateForm('summary', event.target.value)} value={form.summary} />
            {errors.summary && <div className="invalid-feedback" id="summary-error">{errors.summary}</div>}
          </div>
          <div className="col-md-4">
            <label className="form-label fw-semibold" htmlFor="priority">Requested Priority <span aria-hidden="true" className="text-danger">*</span></label>
            <select className="form-select" id="priority" onChange={(event) => updateForm('requestedPriority', event.target.value as Priority)} value={form.requestedPriority}>
              <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
            </select>
          </div>
          <div className="col-12">
            <label className="form-label fw-semibold" htmlFor="description">Description <span aria-hidden="true" className="text-danger">*</span></label>
            <textarea aria-describedby={errors.description ? 'description-error' : undefined} className={`form-control ${errors.description ? 'is-invalid' : ''}`} id="description" onChange={(event) => updateForm('description', event.target.value)} rows={6} value={form.description} />
            {errors.description && <div className="invalid-feedback" id="description-error">{errors.description}</div>}
          </div>
        </div>
        <button className="btn btn-success mt-4" disabled={submitState === 'submitting'} type="submit">{submitState === 'submitting' ? 'Creating Ticket...' : 'Create Ticket'}</button>
      </form>
    </section>
  );
}

export function App() {
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [activeId, setActiveId] = useState('');
  const [loadState, setLoadState] = useState<RequesterLoadState>('loading');
  const [view, setView] = useState<View>('tickets');
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('idle');
  const [categories, setCategories] = useState<Category[]>([]);
  const requester = requesters.find((item) => String(item.id) === activeId);

  useEffect(() => {
    async function loadRequesters() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/development-requesters`);
        if (!response.ok) throw new Error();
        const payload = (await response.json()) as unknown;
        const list = Array.isArray(payload) ? (payload as Requester[]) : [];
        setRequesters(list);
        setLoadState(list.length ? 'ready' : 'empty');
      } catch {
        setLoadState('error');
      }
    }

    void loadRequesters();
  }, []);

  async function checkSystem() {
    setHealthStatus('loading');
    setCategories([]);
    try {
      const health = await fetch(`${apiBaseUrl}/api/health`);
      if (!health.ok) throw new Error();
      const response = await fetch(`${apiBaseUrl}/api/categories`);
      if (!response.ok) throw new Error();
      setCategories((await response.json()) as Category[]);
      setHealthStatus('online');
    } catch {
      setHealthStatus('offline');
    }
  }

  if (requester && loadState === 'ready') {
    return <main className="requester-page min-vh-100"><nav className="navbar border-bottom bg-white"><div className="container flex-wrap gap-2"><span className="navbar-brand fw-bold text-success">TokTickIT</span><div className="d-flex flex-wrap gap-1 align-items-center"><button aria-label="Open My Tickets" className={`btn btn-sm ${view === 'tickets' ? 'btn-success' : 'btn-link text-success'}`} onClick={() => setView('tickets')} type="button">My Tickets</button><button aria-label="Open Create Ticket" className={`btn btn-sm ${view === 'create' ? 'btn-success' : 'btn-link text-success'}`} onClick={() => setView('create')} type="button">Create Ticket</button><span className="small ms-md-2">Requester: <strong>{requester.name}</strong></span><button className="btn btn-outline-success btn-sm" onClick={() => setActiveId('')} type="button">Change Requester</button></div></div></nav><section className="container py-5">{view === 'create' ? <CreateTicketForm requester={requester} /> : <><h1 className="h3">My Tickets</h1><p className="text-secondary">Tickets for {requester.name} will appear here.</p></>}</section></main>;
  }

  return <main className="container py-5 requester-page"><section className="requester-card mx-auto p-4 p-md-5"><span className="small fw-semibold text-success text-uppercase">TokTickIT</span><h1 className="mt-2">TokTickIT IT Service Desk</h1><p className="text-secondary">Select a Development Requester to test the requester ticket workflow. This is a Lab 2 testing context, not real authentication.</p>{loadState === 'loading' && <p role="status">Loading development requesters...</p>}{loadState === 'error' && <div className="alert alert-danger" role="alert">Unable to load Development Requesters. Check the backend and try again.</div>}{loadState === 'empty' && <div className="alert alert-warning" role="alert">No active Development Requesters are available.</div>}{loadState === 'ready' && <><label className="form-label fw-semibold" htmlFor="development-requester">Development Requester</label><select className="form-select" id="development-requester" onChange={(event) => setSelectedId(event.target.value)} value={selectedId}><option value="">Choose a requester</option>{requesters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="btn btn-success mt-3" disabled={!selectedId} onClick={() => setActiveId(selectedId)} type="button">Continue</button></>}<div className="border-top mt-4 pt-3"><button className="btn btn-primary btn-sm" disabled={healthStatus === 'loading'} onClick={checkSystem} type="button">Check System</button>{healthStatus === 'loading' && <p className="mt-3 mb-0" role="status">Loading system status...</p>}{healthStatus === 'online' && <div className="alert alert-success mt-3 mb-0" role="status"><strong>System Status:</strong> Online<p className="mb-0">TokTickIT API is online.</p>{categories.length > 0 && <><h2 className="h6 mt-3">Supported Request Categories</h2><ol className="mb-0">{categories.map((category) => <li key={category.id}>{category.name}</li>)}</ol></>}</div>}{healthStatus === 'offline' && <div className="alert alert-danger mt-3 mb-0" role="alert"><strong>System Status:</strong> Offline<p className="mb-0">Unable to connect to TokTickIT API.</p></div>}</div></section></main>;
}
