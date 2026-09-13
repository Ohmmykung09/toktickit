import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from './AuthGate';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const statuses = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'];

type Lookup = { id: number; name: string };
type Owner = Lookup & { role: string };
type QueueItem = {
  ticketNumber: string;
  summary: string;
  requestedPriority: string;
  itPriority: string;
  status: string;
  updatedAt: string;
  requester: Lookup & { email: string };
  owner: Owner | null;
  category: Lookup;
  relatedSystem: Lookup;
};
type QueueResponse = {
  items: QueueItem[];
  filters: { categories: Lookup[]; relatedSystems: Lookup[]; owners: Owner[] };
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
};
type TicketDetail = QueueItem & {
  description: string;
  createdAt: string;
  requesterResolutionIndicatedAt: string | null;
  attachments: Array<{ id: number; originalFileName: string; mimeType: string; sizeBytes: number; createdAt: string; removedAt: string | null; removalReason: string | null }>;
  publicComments: Array<{ id: number; content: string; createdAt: string; author: Owner }>;
  internalNotes: Array<{ id: number; content: string; createdAt: string; author: Owner }>;
};

function label(value: string) {
  return value.toLowerCase().split('_').map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(' ');
}

function queueErrorMessage(status: number) {
  if (status === 403) return 'You do not have permission to view the IT Staff Ticket Queue.';
  return 'Unable to load the ticket queue. Try again.';
}

function StaffTicketDetail({ ticketNumber, onBack }: { ticketNumber: string; onBack: () => void }) {
  const { authenticatedFetch, user } = useAuth();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [assignees, setAssignees] = useState<Owner[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [publicContent, setPublicContent] = useState('');
  const [internalContent, setInternalContent] = useState('');
  const [posting, setPosting] = useState<'public' | 'internal' | null>(null);

  const load = useCallback(async () => {
    setState('loading'); setMessage('');
    try {
      const [ticketResponse, assigneeResponse] = await Promise.all([
        authenticatedFetch(`${apiBaseUrl}/api/staff/tickets/${encodeURIComponent(ticketNumber)}`),
        authenticatedFetch(`${apiBaseUrl}/api/staff/assignees`)
      ]);
      if (!ticketResponse.ok || !assigneeResponse.ok) throw new Error();
      setTicket(await ticketResponse.json() as TicketDetail);
      setAssignees(await assigneeResponse.json() as Owner[]);
      setState('ready');
    } catch { setMessage('Unable to load this ticket. Try again.'); setState('error'); }
  }, [authenticatedFetch, ticketNumber]);
  useEffect(() => { void load(); }, [load]);

  async function update(path: string, body: Record<string, unknown>) {
    if (!ticket) return;
    setBusy(true); setMessage('');
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/staff/tickets/${encodeURIComponent(ticket.ticketNumber)}/${path}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, expectedUpdatedAt: ticket.updatedAt })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        setMessage(payload?.error?.message ?? 'Unable to save the ticket.');
        if (response.status === 409) await load();
        return;
      }
      setTicket(await response.json() as TicketDetail);
      setMessage('Ticket updated.');
    } catch { setMessage('Unable to reach TokTickIT. Try again.'); }
    finally { setBusy(false); }
  }

  async function downloadAttachment(attachment: TicketDetail['attachments'][number]) {
    setMessage('');
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/staff/tickets/${encodeURIComponent(ticketNumber)}/attachments/${attachment.id}/download`);
      if (!response.ok) { setMessage('Unable to download this attachment. It may have been removed.'); return; }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = attachment.originalFileName; anchor.click();
      URL.revokeObjectURL(url);
    } catch { setMessage('Unable to download this attachment. Try again.'); }
  }

  async function postMessage(kind: 'public' | 'internal', event: FormEvent) {
    event.preventDefault();
    if (!ticket) return;
    const content = (kind === 'public' ? publicContent : internalContent).trim();
    setMessage('');
    if (!content.length || content.length > 2_000) {
      setMessage(`${kind === 'public' ? 'Public Comment' : 'Internal Note'} must contain 1 to 2,000 characters.`);
      return;
    }
    setPosting(kind);
    const path = kind === 'public'
      ? `/api/tickets/${encodeURIComponent(ticket.ticketNumber)}/public-comments`
      : `/api/staff/tickets/${encodeURIComponent(ticket.ticketNumber)}/internal-notes`;
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? `Unable to post the ${kind === 'public' ? 'Public Comment' : 'Internal Note'}.`);
      }
      const created = await response.json() as TicketDetail['publicComments'][number];
      setTicket((current) => current ? {
        ...current,
        ...(kind === 'public'
          ? { publicComments: [...current.publicComments, created] }
          : { internalNotes: [...current.internalNotes, created] })
      } : current);
      if (kind === 'public') setPublicContent(''); else setInternalContent('');
      setMessage(`${kind === 'public' ? 'Public Comment' : 'Internal Note'} posted.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Unable to post the message.');
    } finally {
      setPosting(null);
    }
  }

  if (state === 'loading') return <div className="queue-state" role="status">Loading ticket detail...</div>;
  if (state === 'error' || !ticket) return <div className="queue-state queue-error" role="alert"><p>{message}</p><button className="btn btn-outline-danger" onClick={() => void load()} type="button">Retry</button></div>;
  const allowed: Record<string, string[]> = { NEW: ['OPEN', 'IN_PROGRESS', 'CANCELLED'], OPEN: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'], IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'], WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'], RESOLVED: ['CLOSED', 'REOPENED'], REOPENED: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'], CLOSED: ['REOPENED'], CANCELLED: [] };

  return <section className="staff-detail">
    <button className="btn btn-link text-success px-0" onClick={onBack} type="button">Back to queue</button>
    <header><div><span>{ticket.ticketNumber}</span><h1>{ticket.summary}</h1></div><strong>{label(ticket.status)}</strong></header>
    {message && <div className="alert alert-info" role="status">{message}</div>}
    <div className="staff-detail-grid">
      <article><h2>Request information</h2><dl><div><dt>Requester</dt><dd>{ticket.requester.name}<small>{ticket.requester.email}</small></dd></div><div><dt>Category</dt><dd>{ticket.category.name}</dd></div><div><dt>Related system</dt><dd>{ticket.relatedSystem.name}</dd></div><div><dt>Requested priority</dt><dd>{label(ticket.requestedPriority)}</dd></div></dl><h3>Description</h3><p>{ticket.description}</p></article>
      <aside><h2>Ticket controls</h2>
        <label>Owner<select aria-label="Ticket owner" disabled={busy} onChange={(event) => void update('assignment', { ownerId: event.target.value ? Number(event.target.value) : null })} value={ticket.owner?.id ?? ''}><option value="">Unassigned</option>{assignees.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>
        <button className="btn btn-outline-success btn-sm" disabled={busy || ticket.owner?.id === user.id} onClick={() => void update('assignment', { ownerId: user.id })} type="button">Claim ticket</button>
        <label>IT Priority<select aria-label="Set IT priority" disabled={busy} onChange={(event) => void update('it-priority', { itPriority: event.target.value })} value={ticket.itPriority}>{priorities.map((priority) => <option key={priority} value={priority}>{label(priority)}</option>)}</select></label>
        <label>Status<select aria-label="Set ticket status" disabled={busy || allowed[ticket.status].length === 0} onChange={(event) => { const next = event.target.value; if (['RESOLVED', 'CLOSED', 'CANCELLED', 'REOPENED'].includes(next) && !globalThis.confirm(`Confirm status change to ${label(next)}?`)) return; void update('status', { status: next }); }} value=""><option value="">Choose transition</option>{allowed[ticket.status].map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label>
      </aside>
    </div>
    <section className="staff-attachments"><h2>Attachments</h2>{ticket.attachments.length ? <ul>{ticket.attachments.map((attachment) => <li key={attachment.id}><div><strong>{attachment.originalFileName}</strong><span>{Math.ceil(attachment.sizeBytes / 1024)} KB · {attachment.mimeType}</span></div>{attachment.removedAt ? <p>Removed: {attachment.removalReason ?? 'No reason recorded.'}</p> : <button className="btn btn-sm btn-outline-success" onClick={() => void downloadAttachment(attachment)} type="button">Download</button>}</li>)}</ul> : <p>No attachments.</p>}</section>
    <div className="staff-history">
      <section className="public-history" aria-label="Public Comments"><h2>Public Comments</h2><p className="history-caption">Shared with the Requester and authorized staff.</p>{ticket.publicComments.length ? ticket.publicComments.map((item) => <article key={item.id}><div><strong>{item.author.name}</strong><span>{label(item.author.role)} · {new Date(item.createdAt).toLocaleString()}</span></div><p>{item.content}</p></article>) : <p>No Public Comments yet.</p>}<form onSubmit={(event) => void postMessage('public', event)}><label htmlFor="staff-public-comment">Add Public Comment</label><textarea id="staff-public-comment" maxLength={2_000} onChange={(event) => setPublicContent(event.target.value)} rows={4} value={publicContent} /><footer><span>{publicContent.length} / 2,000</span><button className="btn btn-success btn-sm" disabled={posting !== null} type="submit">{posting === 'public' ? 'Posting...' : 'Post Public Comment'}</button></footer></form></section>
      <section className="internal-history" aria-label="Internal Notes"><h2>Internal Notes</h2><p className="internal-label">Internal - not visible to Requester</p>{ticket.internalNotes.length ? ticket.internalNotes.map((item) => <article key={item.id}><div><strong>{item.author.name}</strong><span>{label(item.author.role)} · {new Date(item.createdAt).toLocaleString()}</span></div><p>{item.content}</p></article>) : <p>No Internal Notes yet.</p>}<form onSubmit={(event) => void postMessage('internal', event)}><label htmlFor="staff-internal-note">Add Internal Note</label><textarea id="staff-internal-note" maxLength={2_000} onChange={(event) => setInternalContent(event.target.value)} rows={4} value={internalContent} /><footer><span>{internalContent.length} / 2,000</span><button className="btn btn-warning btn-sm" disabled={posting !== null} type="submit">{posting === 'internal' ? 'Posting...' : 'Post Internal Note'}</button></footer></form></section>
    </div>
  </section>;
}

export function StaffWorkspace() {
  const { authenticatedFetch } = useAuth();
  const [result, setResult] = useState<QueueResponse | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [selectedTicketNumber, setSelectedTicketNumber] = useState('');
  const [query, setQuery] = useState({ search: '', categoryId: '', relatedSystemId: '', status: '', requestedPriority: '', itPriority: '', owner: '', sortBy: 'updatedAt', sortOrder: 'desc', pageSize: '20' });

  const load = useCallback(async (requestedPage = page) => {
    setState('loading');
    setMessage('');
    const parameters = new URLSearchParams({ page: String(requestedPage), pageSize: query.pageSize, sortBy: query.sortBy, sortOrder: query.sortOrder });
    Object.entries(query).forEach(([key, value]) => {
      if (value && !['pageSize', 'sortBy', 'sortOrder'].includes(key)) parameters.set(key, value);
    });
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/staff/tickets?${parameters}`);
      if (!response.ok) {
        setMessage(queueErrorMessage(response.status));
        setState('error');
        return;
      }
      setResult(await response.json() as QueueResponse);
      setPage(requestedPage);
      setState('ready');
    } catch {
      setMessage('Unable to reach TokTickIT. Check the backend and try again.');
      setState('error');
    }
  }, [authenticatedFetch, page, query]);

  useEffect(() => { void load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasFilters = useMemo(() => Boolean(query.search || query.categoryId || query.relatedSystemId || query.status || query.requestedPriority || query.itPriority || query.owner), [query]);
  function submit(event: FormEvent) { event.preventDefault(); void load(1); }
  function update(key: keyof typeof query, value: string) { setQuery((current) => ({ ...current, [key]: value })); }

  return (
    <main className="staff-page min-vh-100">
      <nav className="staff-nav"><strong>TokTickIT</strong><span>IT Staff Ticket Queue</span></nav>
      <section className="staff-layout">
        {selectedTicketNumber ? <StaffTicketDetail ticketNumber={selectedTicketNumber} onBack={() => setSelectedTicketNumber('')} /> : <>
        <header className="staff-header"><div><h1>Ticket Queue</h1><p>Search, prioritize, and open service requests.</p></div>{result && <strong>{result.pagination.totalItems} tickets</strong>}</header>
        <form className="queue-controls" onSubmit={submit}>
          <label className="queue-search">Search<input aria-label="Search tickets" onChange={(event) => update('search', event.target.value)} placeholder="Ticket, summary, requester" value={query.search} /></label>
          <label>Category<select aria-label="Category" onChange={(event) => update('categoryId', event.target.value)} value={query.categoryId}><option value="">All</option>{result?.filters.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>System<select aria-label="Related system" onChange={(event) => update('relatedSystemId', event.target.value)} value={query.relatedSystemId}><option value="">All</option>{result?.filters.relatedSystems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Status<select aria-label="Status" onChange={(event) => update('status', event.target.value)} value={query.status}><option value="">All</option>{statuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
          <label>Requested<select aria-label="Requested priority" onChange={(event) => update('requestedPriority', event.target.value)} value={query.requestedPriority}><option value="">All</option>{priorities.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
          <label>IT Priority<select aria-label="IT priority" onChange={(event) => update('itPriority', event.target.value)} value={query.itPriority}><option value="">All</option>{priorities.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
          <label>Owner<select aria-label="Owner" onChange={(event) => update('owner', event.target.value)} value={query.owner}><option value="">All</option><option value="unassigned">Unassigned</option><option value="me">Mine</option>{result?.filters.owners.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Sort<select aria-label="Sort tickets" onChange={(event) => update('sortBy', event.target.value)} value={query.sortBy}><option value="updatedAt">Last updated</option><option value="createdAt">Created</option><option value="ticketNumber">Ticket number</option><option value="requestedPriority">Requested priority</option><option value="itPriority">IT priority</option><option value="status">Status</option></select></label>
          <label>Direction<select aria-label="Sort direction" onChange={(event) => update('sortOrder', event.target.value)} value={query.sortOrder}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
          <label>Page size<select aria-label="Page size" onChange={(event) => update('pageSize', event.target.value)} value={query.pageSize}><option>10</option><option>20</option><option>50</option></select></label>
          <button className="btn btn-success" type="submit">Apply</button>
        </form>
        {state === 'loading' && <div className="queue-state" role="status">Loading ticket queue...</div>}
        {state === 'error' && <div className="queue-state queue-error" role="alert"><p>{message}</p><button className="btn btn-outline-danger" onClick={() => void load(page)} type="button">Retry</button></div>}
        {state === 'ready' && result?.items.length === 0 && <div className="queue-state"><h2>{hasFilters ? 'No matching tickets' : 'No tickets yet'}</h2><p>{hasFilters ? 'Adjust the filters and try again.' : 'New service requests will appear here.'}</p></div>}
        {state === 'ready' && result && result.items.length > 0 && <>
          <div className="queue-table-wrap"><table className="queue-table"><thead><tr><th>Ticket</th><th>Summary</th><th>Requester</th><th>Category</th><th>Requested</th><th>IT</th><th>Status</th><th>Owner</th><th>Updated</th><th></th></tr></thead><tbody>{result.items.map((ticket) => <tr key={ticket.ticketNumber}><td><strong>{ticket.ticketNumber}</strong></td><td>{ticket.summary}</td><td>{ticket.requester.name}<small>{ticket.requester.email}</small></td><td>{ticket.category.name}</td><td><span className="queue-tag">{label(ticket.requestedPriority)}</span></td><td><span className="queue-tag queue-tag-it">{label(ticket.itPriority)}</span></td><td>{label(ticket.status)}</td><td>{ticket.owner?.name ?? 'Unassigned'}</td><td>{new Date(ticket.updatedAt).toLocaleDateString()}</td><td><button aria-label={`Open ${ticket.ticketNumber}`} className="btn btn-sm btn-outline-success" onClick={() => setSelectedTicketNumber(ticket.ticketNumber)} type="button">Open</button></td></tr>)}</tbody></table></div>
          <div className="queue-cards">{result.items.map((ticket) => <article key={ticket.ticketNumber}><div><strong>{ticket.ticketNumber}</strong><span>{label(ticket.status)}</span></div><h2>{ticket.summary}</h2><p>{ticket.requester.name} · {ticket.category.name}</p><dl><div><dt>Requested</dt><dd>{label(ticket.requestedPriority)}</dd></div><div><dt>IT Priority</dt><dd>{label(ticket.itPriority)}</dd></div><div><dt>Owner</dt><dd>{ticket.owner?.name ?? 'Unassigned'}</dd></div></dl><button aria-label={`Open ${ticket.ticketNumber} mobile`} className="btn btn-sm btn-outline-success" onClick={() => setSelectedTicketNumber(ticket.ticketNumber)} type="button">Open ticket</button></article>)}</div>
          <footer className="queue-pagination"><button className="btn btn-outline-success btn-sm" disabled={page <= 1} onClick={() => void load(page - 1)} type="button">Previous</button><span>Page {result.pagination.page} of {Math.max(result.pagination.totalPages, 1)}</span><button className="btn btn-outline-success btn-sm" disabled={page >= result.pagination.totalPages} onClick={() => void load(page + 1)} type="button">Next</button></footer>
        </>}
        </>}
      </section>
    </main>
  );
}
