import { useEffect, useState, type FormEvent } from 'react';

type Requester = { id: number; name: string };
type Lookup = { id: number; name: string };
type Category = Lookup;
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type HealthStatus = 'idle' | 'loading' | 'online' | 'offline';
type RequesterLoadState = 'loading' | 'ready' | 'empty' | 'error';
type View = 'tickets' | 'create' | 'detail';

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

type TicketListItem = {
  ticketNumber: string;
  summary: string;
  category: Lookup;
  status: string;
  requestedPriority: string;
  updatedAt: string;
};

type TicketListResponse = {
  items: TicketListItem[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
};

type TicketDetail = TicketListItem & {
  description: string;
  relatedSystem: Lookup;
  createdAt: string;
  attachments: Array<{ id: number; originalFileName: string; mimeType: string; sizeBytes: number; createdAt: string }>;
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

function MyTickets({ requester, onOpenTicket }: { requester: Requester; onOpenTicket: (ticketNumber: string) => void }) {
  const [tickets, setTickets] = useState<TicketListResponse | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState({ q: '', status: '', priority: '', sort: 'updatedAt', page: 1 });

  useEffect(() => {
    async function loadTickets() {
      setLoadState('loading');
      try {
        const params = new URLSearchParams({ page: String(query.page), pageSize: '10', sort: query.sort });
        if (query.q) params.set('q', query.q);
        if (query.status) params.set('status', query.status);
        if (query.priority) params.set('priority', query.priority);
        const response = await fetch(`${apiBaseUrl}/api/tickets?${params}`, {
          headers: { 'X-Development-Requester-Id': String(requester.id) }
        });
        if (!response.ok) throw new Error();
        const payload = (await response.json()) as Partial<TicketListResponse>;
        if (!Array.isArray(payload.items) || !payload.pagination) throw new Error();
        setTickets(payload as TicketListResponse);
        setLoadState('ready');
      } catch {
        setLoadState('error');
      }
    }
    void loadTickets();
  }, [query, requester.id]);

  function changeQuery(change: Partial<typeof query>) {
    setQuery((current) => ({ ...current, ...change, page: change.page ?? 1 }));
  }

  return <section className="ticket-list-panel"><div className="d-flex flex-wrap justify-content-between gap-2 mb-4"><div><h1 className="h3 mb-1">My Tickets</h1><p className="text-secondary mb-0">Support requests created by {requester.name}.</p></div><span className="badge text-bg-light align-self-start">{tickets?.pagination.totalItems ?? 0} tickets</span></div><div className="row g-2 mb-4"><div className="col-md-5"><label className="visually-hidden" htmlFor="ticket-search">Search tickets</label><input className="form-control" id="ticket-search" onChange={(event) => changeQuery({ q: event.target.value })} placeholder="Search ticket number or summary" value={query.q} /></div><div className="col-sm-4 col-md-2"><label className="visually-hidden" htmlFor="ticket-status">Status</label><select className="form-select" id="ticket-status" onChange={(event) => changeQuery({ status: event.target.value })} value={query.status}><option value="">All statuses</option><option value="New">New</option></select></div><div className="col-sm-4 col-md-2"><label className="visually-hidden" htmlFor="ticket-priority">Priority</label><select className="form-select" id="ticket-priority" onChange={(event) => changeQuery({ priority: event.target.value })} value={query.priority}><option value="">All priorities</option><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Critical">Critical</option></select></div><div className="col-sm-4 col-md-3"><label className="visually-hidden" htmlFor="ticket-sort">Sort tickets</label><select className="form-select" id="ticket-sort" onChange={(event) => changeQuery({ sort: event.target.value })} value={query.sort}><option value="updatedAt">Last updated</option><option value="createdAt">Created date</option><option value="ticketNumber">Ticket number</option></select></div></div>{loadState === 'loading' && <p role="status">Loading your tickets...</p>}{loadState === 'error' && <div className="alert alert-danger" role="alert">Unable to load your tickets. Check the backend and try again.</div>}{loadState === 'ready' && tickets?.items.length === 0 && <div className="alert alert-light border">{query.q || query.status || query.priority ? 'No tickets match these filters.' : 'You have not created any tickets yet.'}</div>}{loadState === 'ready' && tickets && tickets.items.length > 0 && <><div className="table-responsive"><table className="table align-middle"><thead><tr><th>Ticket Number</th><th>Summary</th><th>Category</th><th>Status</th><th>Priority</th><th>Last Updated</th></tr></thead><tbody>{tickets.items.map((ticket) => <tr key={ticket.ticketNumber}><td><button className="btn btn-link p-0 text-success fw-semibold" onClick={() => onOpenTicket(ticket.ticketNumber)} type="button">{ticket.ticketNumber}</button></td><td>{ticket.summary}</td><td>{ticket.category.name}</td><td><span className="badge text-bg-light">{ticket.status}</span></td><td>{ticket.requestedPriority}</td><td>{new Date(ticket.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div><div className="d-flex justify-content-between align-items-center"><span className="small text-secondary">Page {tickets.pagination.page} of {tickets.pagination.totalPages}</span><div className="btn-group"><button className="btn btn-outline-success btn-sm" disabled={query.page <= 1} onClick={() => changeQuery({ page: query.page - 1 })} type="button">Previous</button><button className="btn btn-outline-success btn-sm" disabled={query.page >= tickets.pagination.totalPages} onClick={() => changeQuery({ page: query.page + 1 })} type="button">Next</button></div></div></>}</section>;
}

function TicketDetailView({ requester, ticketNumber }: { requester: Requester; ticketNumber: string }) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    async function loadTicket() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/tickets/${ticketNumber}`, { headers: { 'X-Development-Requester-Id': String(requester.id) } });
        if (!response.ok) throw new Error();
        setTicket((await response.json()) as TicketDetail);
        setLoadState('ready');
      } catch {
        setLoadState('error');
      }
    }
    void loadTicket();
  }, [requester.id, ticketNumber]);

  if (loadState === 'loading') return <p role="status">Loading ticket details...</p>;
  if (loadState === 'error' || !ticket) return <div className="alert alert-danger" role="alert">Unable to load this ticket. Check that it belongs to the selected requester.</div>;

  return <section className="ticket-form-panel"><div className="d-flex flex-wrap justify-content-between gap-2 mb-4"><div><p className="text-success fw-semibold mb-1">{ticket.ticketNumber}</p><h1 className="h3 mb-1">{ticket.summary}</h1><p className="text-secondary mb-0">Created by {requester.name}</p></div><span className="badge text-bg-light align-self-start">{ticket.status}</span></div><dl className="row mb-0"><dt className="col-sm-3">Category</dt><dd className="col-sm-9">{ticket.category.name}</dd><dt className="col-sm-3">Related System</dt><dd className="col-sm-9">{ticket.relatedSystem.name}</dd><dt className="col-sm-3">Priority</dt><dd className="col-sm-9">{ticket.requestedPriority}</dd><dt className="col-sm-3">Description</dt><dd className="col-sm-9 text-pre-wrap">{ticket.description}</dd><dt className="col-sm-3">Last Updated</dt><dd className="col-sm-9">{new Date(ticket.updatedAt).toLocaleString()}</dd></dl><section className="border-top mt-4 pt-3"><h2 className="h5">Attachments</h2><p className="text-secondary mb-0">Attachment upload and management will be available in the next step.</p></section></section>;
}

export function App() {
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [activeId, setActiveId] = useState('');
  const [loadState, setLoadState] = useState<RequesterLoadState>('loading');
  const [view, setView] = useState<View>('tickets');
  const [selectedTicketNumber, setSelectedTicketNumber] = useState('');
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
    return <main className="requester-page min-vh-100"><nav className="navbar border-bottom bg-white"><div className="container flex-wrap gap-2"><span className="navbar-brand fw-bold text-success">TokTickIT</span><div className="d-flex flex-wrap gap-1 align-items-center"><button aria-label="Open My Tickets" className={`btn btn-sm ${view === 'tickets' ? 'btn-success' : 'btn-link text-success'}`} onClick={() => setView('tickets')} type="button">My Tickets</button><button aria-label="Open Create Ticket" className={`btn btn-sm ${view === 'create' ? 'btn-success' : 'btn-link text-success'}`} onClick={() => setView('create')} type="button">Create Ticket</button><span className="small ms-md-2">Requester: <strong>{requester.name}</strong></span><button className="btn btn-outline-success btn-sm" onClick={() => { setActiveId(''); setView('tickets'); }} type="button">Change Requester</button></div></div></nav><section className="container py-5">{view === 'create' && <CreateTicketForm requester={requester} />}{view === 'tickets' && <MyTickets requester={requester} onOpenTicket={(ticketNumber) => { setSelectedTicketNumber(ticketNumber); setView('detail'); }} />}{view === 'detail' && <TicketDetailView requester={requester} ticketNumber={selectedTicketNumber} />}</section></main>;
  }

  return <main className="container py-5 requester-page"><section className="requester-card mx-auto p-4 p-md-5"><span className="small fw-semibold text-success text-uppercase">TokTickIT</span><h1 className="mt-2">TokTickIT IT Service Desk</h1><p className="text-secondary">Select a Development Requester to test the requester ticket workflow. This is a Lab 2 testing context, not real authentication.</p>{loadState === 'loading' && <p role="status">Loading development requesters...</p>}{loadState === 'error' && <div className="alert alert-danger" role="alert">Unable to load Development Requesters. Check the backend and try again.</div>}{loadState === 'empty' && <div className="alert alert-warning" role="alert">No active Development Requesters are available.</div>}{loadState === 'ready' && <><label className="form-label fw-semibold" htmlFor="development-requester">Development Requester</label><select className="form-select" id="development-requester" onChange={(event) => setSelectedId(event.target.value)} value={selectedId}><option value="">Choose a requester</option>{requesters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="btn btn-success mt-3" disabled={!selectedId} onClick={() => setActiveId(selectedId)} type="button">Continue</button></>}<div className="border-top mt-4 pt-3"><button className="btn btn-primary btn-sm" disabled={healthStatus === 'loading'} onClick={checkSystem} type="button">Check System</button>{healthStatus === 'loading' && <p className="mt-3 mb-0" role="status">Loading system status...</p>}{healthStatus === 'online' && <div className="alert alert-success mt-3 mb-0" role="status"><strong>System Status:</strong> Online<p className="mb-0">TokTickIT API is online.</p>{categories.length > 0 && <><h2 className="h6 mt-3">Supported Request Categories</h2><ol className="mb-0">{categories.map((category) => <li key={category.id}>{category.name}</li>)}</ol></>}</div>}{healthStatus === 'offline' && <div className="alert alert-danger mt-3 mb-0" role="alert"><strong>System Status:</strong> Offline<p className="mb-0">Unable to connect to TokTickIT API.</p></div>}</div></section></main>;
}
