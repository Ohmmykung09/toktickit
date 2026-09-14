import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from './AuthGate';
import { messageCharacterCount, messageDraftError } from './message-policy';
import { StaffWorkspace } from './StaffWorkspace';

type Requester = { id: number; name: string };
type Lookup = { id: number; name: string };
type Category = Lookup;
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type HealthStatus = 'idle' | 'loading' | 'online' | 'offline';
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
  attachments: Attachment[];
  requesterResolutionIndicatedAt: string | null;
  publicComments: PublicComment[];
};

type PublicComment = {
  id: number;
  content: string;
  createdAt: string;
  author: { id: number; name: string; role: string };
};

type Attachment = {
  id: number;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  removedAt: string | null;
  removalReason: string | null;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const allowedAttachmentExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
const maximumAttachmentSize = 5 * 1024 * 1024;

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

async function errorMessage(response: Response, fallback: string) {
  if (response.status === 413) return 'Attachment is too large. Maximum size is 5 MB.';

  if (response.headers.get('content-type')?.includes('application/json')) {
    const payload = await response.json().catch(() => null) as {
      error?: unknown | { message?: unknown };
      message?: unknown;
    } | null;
    if (typeof payload?.error === 'string') return payload.error;
    if (payload?.error && typeof payload.error === 'object' && 'message' in payload.error) {
      const message = (payload.error as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
    if (typeof payload?.message === 'string') return payload.message;
  }

  return fallback;
}

function validAttachmentFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return Boolean(extension && allowedAttachmentExtensions.includes(extension) && file.size <= maximumAttachmentSize);
}

function CreateTicketForm({ requester }: { requester: Requester }) {
  const { authenticatedFetch } = useAuth();
  const [categories, setCategories] = useState<Lookup[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<Lookup[]>([]);
  const [lookupState, setLookupState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [form, setForm] = useState<TicketForm>(initialTicketForm);
  const [errors, setErrors] = useState<Partial<Record<keyof TicketForm, string>>>({});
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'error' | 'success'>('idle');
  const [submitError, setSubmitError] = useState('');
  const [createdTicket, setCreatedTicket] = useState<TicketResponse | null>(null);
  const [requestKey, setRequestKey] = useState('');
  const [selectedAttachments, setSelectedAttachments] = useState<File[]>([]);
  const [attachmentMessage, setAttachmentMessage] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadLookups() {
      try {
        const [categoryResponse, relatedSystemResponse] = await Promise.all([
          authenticatedFetch(`${apiBaseUrl}/api/categories`),
          authenticatedFetch(`${apiBaseUrl}/api/related-systems`)
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
  }, [authenticatedFetch]);

  function updateForm<K extends keyof TicketForm>(field: K, value: TicketForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function chooseAttachments(files: FileList | null) {
    const selected = Array.from(files ?? []);
    setAttachmentMessage('');
    if (selected.length > 5 || selected.some((file) => !validAttachmentFile(file))) {
      setSelectedAttachments([]);
      setAttachmentError('Choose up to five JPG, JPEG, PNG, WEBP, or PDF files that are 5 MB or smaller.');
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
      return;
    }
    setAttachmentError('');
    setSelectedAttachments(selected);
  }

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateTicketForm(form);
    setErrors(validationErrors);
    setSubmitError('');
    setAttachmentError('');
    setAttachmentMessage('');

    if (Object.keys(validationErrors).length > 0) return;

    const key = requestKey || idempotencyKey();
    setRequestKey(key);
    setSubmitState('submitting');

    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

      if (selectedAttachments.length > 0) {
        try {
          for (const file of selectedAttachments) {
            const formData = new FormData();
            formData.append('file', file);
            const attachmentResponse = await authenticatedFetch(`${apiBaseUrl}/api/tickets/${payload.ticketNumber}/attachments`, {
              method: 'POST',
              body: formData
            });
            if (!attachmentResponse.ok) {
              setAttachmentError(await errorMessage(
                attachmentResponse,
                `Ticket ${payload.ticketNumber} was created, but ${file.name} could not be uploaded.`
              ));
              return;
            }
          }
          setAttachmentMessage(`${selectedAttachments.length} attachment${selectedAttachments.length === 1 ? '' : 's'} uploaded successfully.`);
          setSelectedAttachments([]);
          if (attachmentInputRef.current) attachmentInputRef.current.value = '';
        } catch {
          setAttachmentError(`Ticket ${payload.ticketNumber} was created, but an attachment could not be uploaded.`);
        }
      }
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
      {attachmentError && <div className="alert alert-warning" role="alert">{attachmentError}</div>}
      {attachmentMessage && <div className="alert alert-success" role="status">{attachmentMessage}</div>}

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
          <div className="col-12">
            <label className="form-label fw-semibold" htmlFor="create-ticket-attachments">Attachments <span className="text-secondary fw-normal">(optional)</span></label>
            <input accept=".jpg,.jpeg,.png,.webp,.pdf" className="form-control" id="create-ticket-attachments" multiple onChange={(event) => chooseAttachments(event.target.files)} ref={attachmentInputRef} type="file" />
            <div className="form-text">Up to 5 files. JPG, JPEG, PNG, WEBP, or PDF; 5 MB maximum per file.</div>
            {selectedAttachments.length > 0 && <p className="small text-secondary mt-2 mb-0">Selected: {selectedAttachments.map((file) => file.name).join(', ')}</p>}
          </div>
        </div>
        <button className="btn btn-success mt-4" disabled={submitState === 'submitting'} type="submit">{submitState === 'submitting' ? 'Creating Ticket...' : 'Create Ticket'}</button>
      </form>
    </section>
  );
}

function MyTickets({ requester, onOpenTicket }: { requester: Requester; onOpenTicket: (ticketNumber: string) => void }) {
  const { authenticatedFetch } = useAuth();
  const [tickets, setTickets] = useState<TicketListResponse | null>(null);
  const [categories, setCategories] = useState<Lookup[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState({
    q: '',
    categoryId: '',
    status: '',
    priority: '',
    sort: 'updatedAt',
    direction: 'desc',
    page: 1
  });

  useEffect(() => {
    async function loadTickets() {
      setLoadState('loading');
      try {
        const params = new URLSearchParams({
          page: String(query.page),
          pageSize: '10',
          sort: query.sort,
          direction: query.direction
        });
        if (query.q) params.set('q', query.q);
        if (query.categoryId) params.set('categoryId', query.categoryId);
        if (query.status) params.set('status', query.status);
        if (query.priority) params.set('priority', query.priority);
        const [categoryResponse, response] = await Promise.all([
          authenticatedFetch(`${apiBaseUrl}/api/categories`),
          authenticatedFetch(`${apiBaseUrl}/api/tickets?${params}`)
        ]);
        if (!categoryResponse.ok || !response.ok) throw new Error();
        const [categoryPayload, payload] = await Promise.all([
          categoryResponse.json() as Promise<Lookup[]>,
          response.json() as Promise<Partial<TicketListResponse>>
        ]);
        if (!Array.isArray(categoryPayload)) throw new Error();
        if (!Array.isArray(payload.items) || !payload.pagination) throw new Error();
        setCategories(categoryPayload);
        setTickets(payload as TicketListResponse);
        setLoadState('ready');
      } catch {
        setLoadState('error');
      }
    }
    void loadTickets();
  }, [authenticatedFetch, query]);

  function changeQuery(change: Partial<typeof query>) {
    setQuery((current) => ({ ...current, ...change, page: change.page ?? 1 }));
  }

  const hasFilters = Boolean(query.q || query.categoryId || query.status || query.priority);

  return (
    <section className="ticket-list-panel">
      <div className="d-flex flex-wrap justify-content-between gap-2 mb-4">
        <div><h1 className="h3 mb-1">My Tickets</h1><p className="text-secondary mb-0">Support requests created by {requester.name}.</p></div>
        <span className="badge text-bg-light align-self-start">{tickets?.pagination.totalItems ?? 0} tickets</span>
      </div>
      <div className="row g-2 mb-4">
        <div className="col-md-4"><label className="visually-hidden" htmlFor="ticket-search">Search tickets</label><input className="form-control" id="ticket-search" onChange={(event) => changeQuery({ q: event.target.value })} placeholder="Search ticket number or summary" value={query.q} /></div>
        <div className="col-sm-6 col-md-2"><label className="visually-hidden" htmlFor="ticket-category">Category</label><select className="form-select" id="ticket-category" onChange={(event) => changeQuery({ categoryId: event.target.value })} value={query.categoryId}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
        <div className="col-sm-6 col-md-2"><label className="visually-hidden" htmlFor="ticket-status">Status</label><select className="form-select" id="ticket-status" onChange={(event) => changeQuery({ status: event.target.value })} value={query.status}><option value="">All statuses</option><option value="New">New</option></select></div>
        <div className="col-sm-6 col-md-2"><label className="visually-hidden" htmlFor="ticket-priority">Priority</label><select className="form-select" id="ticket-priority" onChange={(event) => changeQuery({ priority: event.target.value })} value={query.priority}><option value="">All priorities</option><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Critical">Critical</option></select></div>
        <div className="col-sm-6 col-md-2"><label className="visually-hidden" htmlFor="ticket-sort">Sort tickets</label><select className="form-select" id="ticket-sort" onChange={(event) => changeQuery({ sort: event.target.value })} value={query.sort}><option value="updatedAt">Last updated</option><option value="createdAt">Created date</option><option value="ticketNumber">Ticket number</option></select></div>
        <div className="col-sm-6 col-md-2"><label className="visually-hidden" htmlFor="ticket-direction">Sort direction</label><select className="form-select" id="ticket-direction" onChange={(event) => changeQuery({ direction: event.target.value })} value={query.direction}><option value="desc">Descending</option><option value="asc">Ascending</option></select></div>
      </div>
      {loadState === 'loading' && <p role="status">Loading your tickets...</p>}
      {loadState === 'error' && <div className="alert alert-danger" role="alert">Unable to load your tickets. Check the backend and try again.</div>}
      {loadState === 'ready' && tickets?.items.length === 0 && <div className="alert alert-light border">{hasFilters ? 'No tickets match these filters.' : 'You have not created any tickets yet.'}</div>}
      {loadState === 'ready' && tickets && tickets.items.length > 0 && <><div className="table-responsive"><table className="table align-middle"><thead><tr><th>Ticket Number</th><th>Summary</th><th>Category</th><th>Status</th><th>Priority</th><th>Last Updated</th></tr></thead><tbody>{tickets.items.map((ticket) => <tr key={ticket.ticketNumber}><td><button className="btn btn-link p-0 text-success fw-semibold" onClick={() => onOpenTicket(ticket.ticketNumber)} type="button">{ticket.ticketNumber}</button></td><td>{ticket.summary}</td><td>{ticket.category.name}</td><td><span className="badge text-bg-light">{ticket.status}</span></td><td>{ticket.requestedPriority}</td><td>{new Date(ticket.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div><div className="d-flex justify-content-between align-items-center"><span className="small text-secondary">Page {tickets.pagination.page} of {tickets.pagination.totalPages}</span><div className="btn-group"><button className="btn btn-outline-success btn-sm" disabled={query.page <= 1} onClick={() => changeQuery({ page: query.page - 1 })} type="button">Previous</button><button className="btn btn-outline-success btn-sm" disabled={query.page >= tickets.pagination.totalPages} onClick={() => changeQuery({ page: query.page + 1 })} type="button">Next</button></div></div></>}
    </section>
  );
}

function TicketDetailView({ requester, ticketNumber }: { requester: Requester; ticketNumber: string }) {
  const { authenticatedFetch } = useAuth();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const [posting, setPosting] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    async function loadTicket() {
      try {
        const response = await authenticatedFetch(`${apiBaseUrl}/api/tickets/${ticketNumber}`);
        if (!response.ok) throw new Error();
        const payload = await response.json() as TicketDetail;
        setTicket({
          ...payload,
          requesterResolutionIndicatedAt: payload.requesterResolutionIndicatedAt ?? null,
          publicComments: payload.publicComments ?? []
        });
        setLoadState('ready');
      } catch {
        setLoadState('error');
      }
    }
    void loadTicket();
  }, [authenticatedFetch, ticketNumber]);

  async function postComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = comment.trim();
    setMessage('');
    const validationError = messageDraftError(comment, 'Public Comment');
    if (validationError) {
      setMessage(validationError);
      return;
    }
    const knownCommentIds = new Set(ticket?.publicComments.map((item) => item.id) ?? []);
    setPosting(true);
    let uncertainResult = true;
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/tickets/${encodeURIComponent(ticketNumber)}/public-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (!response.ok) {
        uncertainResult = false;
        throw new Error(await errorMessage(response, 'Unable to post the Public Comment.'));
      }
      const created = await response.json() as PublicComment;
      setTicket((current) => current ? { ...current, publicComments: [...current.publicComments, created] } : current);
      setComment('');
      setMessage('Public Comment posted.');
    } catch (caught) {
      let reconciled = false;
      if (uncertainResult) {
        try {
          const response = await authenticatedFetch(`${apiBaseUrl}/api/tickets/${encodeURIComponent(ticketNumber)}`);
          if (response.ok) {
            const payload = await response.json() as TicketDetail;
            const refreshed = { ...payload, publicComments: payload.publicComments ?? [] };
            reconciled = refreshed.publicComments.some((item) =>
              !knownCommentIds.has(item.id) && item.author.id === requester.id && item.content === content
            );
            setTicket(refreshed);
          }
        } catch {
          // Preserve the draft when the authoritative timeline cannot be reconciled.
        }
      }
      if (reconciled) {
        setComment('');
        setMessage('Public Comment posted.');
      } else {
        setMessage(caught instanceof Error ? caught.message : 'Unable to post the Public Comment.');
      }
    } finally {
      setPosting(false);
    }
  }

  async function indicateResolved() {
    if (!globalThis.confirm('Confirm that the problem appears resolved? This does not change the formal ticket status.')) return;
    setResolving(true);
    setMessage('');
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/tickets/${encodeURIComponent(ticketNumber)}/problem-appears-resolved`, { method: 'POST' });
      if (!response.ok) throw new Error(await errorMessage(response, 'Unable to record the resolution indication.'));
      const payload = await response.json() as { requesterResolutionIndicatedAt: string };
      setTicket((current) => current ? { ...current, requesterResolutionIndicatedAt: payload.requesterResolutionIndicatedAt } : current);
      setMessage('Problem Appears Resolved indication recorded.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Unable to record the resolution indication.');
    } finally {
      setResolving(false);
    }
  }

  if (loadState === 'loading') return <p role="status">Loading ticket details...</p>;
  if (loadState === 'error' || !ticket) return <div className="alert alert-danger" role="alert">Unable to load this ticket. Check that it belongs to your signed-in account.</div>;

  return <section className="ticket-form-panel">
    <div className="d-flex flex-wrap justify-content-between gap-2 mb-4"><div><p className="text-success fw-semibold mb-1">{ticket.ticketNumber}</p><h1 className="h3 mb-1">{ticket.summary}</h1><p className="text-secondary mb-0">Created by {requester.name}</p></div><span className="badge text-bg-light align-self-start">{ticket.status}</span></div>
    {message && <div className="alert alert-info" role="status">{message}</div>}
    <dl className="row mb-0"><dt className="col-sm-3">Category</dt><dd className="col-sm-9">{ticket.category.name}</dd><dt className="col-sm-3">Related System</dt><dd className="col-sm-9">{ticket.relatedSystem.name}</dd><dt className="col-sm-3">Priority</dt><dd className="col-sm-9">{ticket.requestedPriority}</dd><dt className="col-sm-3">Description</dt><dd className="col-sm-9 text-pre-wrap">{ticket.description}</dd><dt className="col-sm-3">Last Updated</dt><dd className="col-sm-9">{new Date(ticket.updatedAt).toLocaleString()}</dd></dl>
    <section className="resolution-indication border-top mt-4 pt-3">
      <h2 className="h5">Resolution indication</h2>
      {ticket.requesterResolutionIndicatedAt
        ? <p className="alert alert-success mb-0">Problem Appears Resolved recorded {new Date(ticket.requesterResolutionIndicatedAt).toLocaleString()}.</p>
        : <><p className="small text-secondary">Use this when the problem appears resolved. IT Staff still controls the formal ticket status.</p><button className="btn btn-outline-success" disabled={resolving} onClick={() => void indicateResolved()} type="button">{resolving ? 'Recording...' : 'Problem Appears Resolved'}</button></>}
    </section>
    <AttachmentSection initialAttachments={ticket.attachments} ticketNumber={ticket.ticketNumber} />
    <section className="public-comments border-top mt-4 pt-3" aria-label="Public Comments">
      <h2 className="h5">Public Comments</h2>
      <p className="small text-secondary">Shared with you and authorized IT Staff.</p>
      <div className="comment-timeline">
        {ticket.publicComments.length
          ? ticket.publicComments.map((item) => <article className="border-top py-3" key={item.id}><div className="d-flex flex-wrap justify-content-between gap-2"><strong>{item.author.name} <span className="fw-normal text-secondary">({item.author.role})</span></strong><time className="small text-secondary">{new Date(item.createdAt).toLocaleString()}</time></div><p className="text-pre-wrap mb-0 mt-1">{item.content}</p></article>)
          : <p className="text-secondary">No Public Comments yet.</p>}
      </div>
      <form onSubmit={postComment}>
        <label className="form-label fw-semibold" htmlFor="requester-public-comment">Add Public Comment</label>
        <textarea className="form-control" id="requester-public-comment" onChange={(event) => setComment(event.target.value)} rows={4} value={comment} />
        <div className="d-flex justify-content-between align-items-center gap-3 mt-2"><span className="small text-secondary">{messageCharacterCount(comment)} / 2,000</span><button className="btn btn-success" disabled={posting} type="submit">{posting ? 'Posting...' : 'Post Public Comment'}</button></div>
      </form>
    </section>
  </section>;
}

function AttachmentSection({ ticketNumber, initialAttachments }: { ticketNumber: string; initialAttachments: Attachment[] }) {
  const { authenticatedFetch } = useAuth();
  const [attachments, setAttachments] = useState(initialAttachments);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removalReasons, setRemovalReasons] = useState<Record<number, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeAttachmentCount = attachments.filter((attachment) => !attachment.removedAt).length;

  async function uploadAttachment() {
    if (!selectedFile) {
      setMessage('Choose an attachment before uploading.');
      return;
    }
    if (!validAttachmentFile(selectedFile)) {
      setMessage('Choose a JPG, JPEG, PNG, WEBP, or PDF file that is 5 MB or smaller.');
      return;
    }
    if (activeAttachmentCount >= 5) {
      setMessage('A ticket can have at most five active attachments.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const response = await authenticatedFetch(`${apiBaseUrl}/api/tickets/${ticketNumber}/attachments`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(await errorMessage(response, 'Unable to upload attachment.'));
      const payload = await response.json().catch(() => null) as Attachment | null;
      if (!payload?.id) throw new Error('Unable to upload attachment.');
      setAttachments((current) => [payload, ...current]);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
      setMessage('Attachment uploaded successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to upload attachment.');
    } finally {
      setBusy(false);
    }
  }

  async function removeAttachment(attachment: Attachment) {
    const reason = removalReasons[attachment.id]?.trim() ?? '';
    if (reason.length < 3 || reason.length > 500) {
      setMessage('Removal reason must contain 3 to 500 characters.');
      return;
    }
    if (!window.confirm(`Remove ${attachment.originalFileName}?`)) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/tickets/${ticketNumber}/attachments/${attachment.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });
      if (!response.ok) throw new Error(await errorMessage(response, 'Unable to remove attachment.'));
      const payload = response.status === 204
        ? { ...attachment, removedAt: new Date().toISOString(), removalReason: reason }
        : await response.json().catch(() => null) as Attachment | null;
      if (!payload?.id) throw new Error('Unable to read the removed attachment metadata.');
      setAttachments((current) => current.map((item) => item.id === attachment.id ? payload : item));
      setRemovalReasons((current) => ({ ...current, [attachment.id]: '' }));
      setMessage('Attachment removed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to remove attachment.');
    } finally {
      setBusy(false);
    }
  }

  async function downloadAttachment(attachment: Attachment) {
    setBusy(true);
    setMessage('');
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/tickets/${ticketNumber}/attachments/${attachment.id}/download`);
      if (!response.ok) throw new Error('Unable to download attachment.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.originalFileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to download attachment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-top mt-4 pt-3">
      <h2 className="h5">Attachments</h2>
      <p className="small text-secondary">JPG, JPEG, PNG, WEBP, or PDF. Maximum 5 MB each and 5 active files per ticket.</p>
      <div className="input-group"><input accept=".jpg,.jpeg,.png,.webp,.pdf" aria-label="Attachment file" className="form-control" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} ref={inputRef} type="file" /><button className="btn btn-success" disabled={busy} onClick={uploadAttachment} type="button">Upload</button></div>
      {message && <p className="mt-2 mb-0" role="status">{message}</p>}
      <ul className="list-group list-group-flush mt-3">
        {attachments.map((attachment) => (
          <li className="list-group-item px-0" key={attachment.id}>
            <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center">
              <span>{attachment.originalFileName} <span className="text-secondary small">({Math.ceil(attachment.sizeBytes / 1024)} KB)</span> {attachment.removedAt && <span className="badge text-bg-secondary">Removed</span>}</span>
              {!attachment.removedAt && <span className="btn-group"><button className="btn btn-outline-success btn-sm" disabled={busy} onClick={() => downloadAttachment(attachment)} type="button">Download</button><button className="btn btn-outline-danger btn-sm" disabled={busy} onClick={() => removeAttachment(attachment)} type="button">Remove</button></span>}
            </div>
            {!attachment.removedAt && <div className="mt-2"><label className="form-label small mb-1" htmlFor={`removal-reason-${attachment.id}`}>Removal reason for {attachment.originalFileName}</label><input className="form-control form-control-sm" id={`removal-reason-${attachment.id}`} maxLength={500} onChange={(event) => setRemovalReasons((current) => ({ ...current, [attachment.id]: event.target.value }))} placeholder="Reason required before removal" value={removalReasons[attachment.id] ?? ''} /></div>}
            {attachment.removedAt && <p className="small text-secondary mt-2 mb-0">Removed {new Date(attachment.removedAt).toLocaleString()}. Reason: {attachment.removalReason ?? 'Not recorded.'}</p>}
          </li>
        ))}
      </ul>
      {activeAttachmentCount === 0 && <p className="text-secondary small mt-3 mb-0">No active attachments.</p>}
    </section>
  );
}

export function App() {
  const { authenticatedFetch, user } = useAuth();
  const [view, setView] = useState<View>('tickets');
  const [selectedTicketNumber, setSelectedTicketNumber] = useState('');
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('idle');
  const [categories, setCategories] = useState<Category[]>([]);
  const requester = { id: user.id, name: user.name };

  async function checkSystem() {
    setHealthStatus('loading');
    setCategories([]);
    try {
      const health = await fetch(`${apiBaseUrl}/api/health`);
      if (!health.ok) throw new Error();
      const response = await authenticatedFetch(`${apiBaseUrl}/api/categories`);
      if (!response.ok) throw new Error();
      setCategories((await response.json()) as Category[]);
      setHealthStatus('online');
    } catch {
      setHealthStatus('offline');
    }
  }

  if (user.role !== 'REQUESTER') {
    return <StaffWorkspace />;
  }

  return (
    <main className="requester-page min-vh-100">
      <nav className="navbar border-bottom bg-white">
        <div className="container flex-wrap gap-2">
          <span className="navbar-brand fw-bold text-success">TokTickIT</span>
          <div className="d-flex flex-wrap gap-1 align-items-center">
            <button aria-label="Open My Tickets" className={`btn btn-sm ${view === 'tickets' ? 'btn-success' : 'btn-link text-success'}`} onClick={() => setView('tickets')} type="button">My Tickets</button>
            <button aria-label="Open Create Ticket" className={`btn btn-sm ${view === 'create' ? 'btn-success' : 'btn-link text-success'}`} onClick={() => setView('create')} type="button">Create Ticket</button>
            <button className="btn btn-primary btn-sm" disabled={healthStatus === 'loading'} onClick={checkSystem} type="button">Check System</button>
          </div>
        </div>
      </nav>
      <section className="container py-5">
        {healthStatus === 'loading' && <p role="status">Loading system status...</p>}
        {healthStatus === 'online' && <div className="alert alert-success" role="status"><strong>System Status:</strong> Online<p className="mb-0">TokTickIT API is online.</p>{categories.length > 0 && <><h2 className="h6 mt-3">Supported Request Categories</h2><ol className="mb-0">{categories.map((category) => <li key={category.id}>{category.name}</li>)}</ol></>}</div>}
        {healthStatus === 'offline' && <div className="alert alert-danger" role="alert"><strong>System Status:</strong> Offline<p className="mb-0">Unable to connect to TokTickIT API.</p></div>}
        {view === 'create' && <CreateTicketForm requester={requester} />}
        {view === 'tickets' && <MyTickets requester={requester} onOpenTicket={(ticketNumber) => { setSelectedTicketNumber(ticketNumber); setView('detail'); }} />}
        {view === 'detail' && <TicketDetailView requester={requester} ticketNumber={selectedTicketNumber} />}
      </section>
    </main>
  );
}
