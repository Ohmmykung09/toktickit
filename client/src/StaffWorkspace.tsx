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

function label(value: string) {
  return value.toLowerCase().split('_').map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(' ');
}

function queueErrorMessage(status: number) {
  if (status === 403) return 'You do not have permission to view the IT Staff Ticket Queue.';
  return 'Unable to load the ticket queue. Try again.';
}

export function StaffWorkspace() {
  const { authenticatedFetch } = useAuth();
  const [result, setResult] = useState<QueueResponse | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
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
          <div className="queue-table-wrap"><table className="queue-table"><thead><tr><th>Ticket</th><th>Summary</th><th>Requester</th><th>Category</th><th>Requested</th><th>IT</th><th>Status</th><th>Owner</th><th>Updated</th><th></th></tr></thead><tbody>{result.items.map((ticket) => <tr key={ticket.ticketNumber}><td><strong>{ticket.ticketNumber}</strong></td><td>{ticket.summary}</td><td>{ticket.requester.name}<small>{ticket.requester.email}</small></td><td>{ticket.category.name}</td><td><span className="queue-tag">{label(ticket.requestedPriority)}</span></td><td><span className="queue-tag queue-tag-it">{label(ticket.itPriority)}</span></td><td>{label(ticket.status)}</td><td>{ticket.owner?.name ?? 'Unassigned'}</td><td>{new Date(ticket.updatedAt).toLocaleDateString()}</td><td><button className="btn btn-sm btn-outline-success" type="button">Open</button></td></tr>)}</tbody></table></div>
          <div className="queue-cards">{result.items.map((ticket) => <article key={ticket.ticketNumber}><div><strong>{ticket.ticketNumber}</strong><span>{label(ticket.status)}</span></div><h2>{ticket.summary}</h2><p>{ticket.requester.name} · {ticket.category.name}</p><dl><div><dt>Requested</dt><dd>{label(ticket.requestedPriority)}</dd></div><div><dt>IT Priority</dt><dd>{label(ticket.itPriority)}</dd></div><div><dt>Owner</dt><dd>{ticket.owner?.name ?? 'Unassigned'}</dd></div></dl><button className="btn btn-sm btn-outline-success" type="button">Open ticket</button></article>)}</div>
          <footer className="queue-pagination"><button className="btn btn-outline-success btn-sm" disabled={page <= 1} onClick={() => void load(page - 1)} type="button">Previous</button><span>Page {result.pagination.page} of {Math.max(result.pagination.totalPages, 1)}</span><button className="btn btn-outline-success btn-sm" disabled={page >= result.pagination.totalPages} onClick={() => void load(page + 1)} type="button">Next</button></footer>
        </>}
      </section>
    </main>
  );
}
