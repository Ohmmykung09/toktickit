import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthGate';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

type DrillTicket = { ticketNumber: string; summary: string; status: string; updatedAt: string; itPriority?: string; drillDown: { type: string; ticketNumber: string } };
type RequesterDashboardData = {
  metrics: { openTickets: number; waitingForRequester: number; recentlyUpdatedCount: number; recentlyResolvedCount: number };
  attentionTickets: DrillTicket[];
  recentTickets: DrillTicket[];
};
type StaffDashboardData = {
  metrics: { unassignedTickets: number; myTickets: number; myActionsTaken: number; operationalTickets: number; byStatus: Record<string, number>; byItPriority: Record<string, number> };
  urgentTickets: DrillTicket[];
};

function label(value: string) {
  return value.toLowerCase().split('_').map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(' ');
}

async function dashboardError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return body?.error?.message ?? 'Unable to load the dashboard.';
}

function TicketLinks({ tickets, onOpenTicket }: { tickets: DrillTicket[]; onOpenTicket: (ticketNumber: string) => void }) {
  if (!tickets.length) return <p className="dashboard-empty">Nothing needs your attention right now.</p>;
  return <div className="dashboard-ticket-list">{tickets.map((ticket) => <article key={ticket.ticketNumber}>
    <div><strong>{ticket.ticketNumber}</strong><span>{label(ticket.status)}{ticket.itPriority ? ` · ${label(ticket.itPriority)}` : ''}</span></div>
    <h3>{ticket.summary}</h3><time>{new Date(ticket.updatedAt).toLocaleString()}</time>
    <button className="btn btn-outline-success btn-sm" onClick={() => onOpenTicket(ticket.ticketNumber)} type="button">Open ticket</button>
  </article>)}</div>;
}

export function RequesterDashboard({ onOpenTicket }: { onOpenTicket: (ticketNumber: string) => void }) {
  const { authenticatedFetch } = useAuth();
  const [data, setData] = useState<RequesterDashboardData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setState('loading'); setMessage('');
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/dashboard/requester`);
      if (!response.ok) throw new Error(await dashboardError(response));
      setData(await response.json() as RequesterDashboardData); setState('ready');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load the dashboard.'); setState('error'); }
  }, [authenticatedFetch]);
  useEffect(() => { void load(); }, [load]);

  return <section className="dashboard-page requester-dashboard" aria-label="Requester Dashboard">
    <header className="dashboard-header"><div><h1>Dashboard</h1><p>A concise view of your open and recently updated Tickets.</p></div></header>
    {state === 'loading' && <p role="status">Loading dashboard...</p>}
    {state === 'error' && <div className="dashboard-state dashboard-error" role="alert"><p>{message}</p><button className="btn btn-outline-danger" onClick={() => void load()} type="button">Retry</button></div>}
    {state === 'ready' && data && <>
      <div className="dashboard-metrics"><article><strong>{data.metrics.openTickets}</strong><span>Open Tickets</span></article><article><strong>{data.metrics.waitingForRequester}</strong><span>Waiting for Requester</span></article><article><strong>{data.metrics.recentlyUpdatedCount}</strong><span>Updated in 7 days</span></article><article><strong>{data.metrics.recentlyResolvedCount}</strong><span>Resolved in 7 days</span></article></div>
      <div className="dashboard-columns"><section><h2>Needs your attention</h2><p className="dashboard-caption">Tickets currently waiting for a response.</p><TicketLinks tickets={data.attentionTickets} onOpenTicket={onOpenTicket} /></section><section><h2>Recently updated</h2><p className="dashboard-caption">Your five most recently updated Tickets.</p><TicketLinks tickets={data.recentTickets} onOpenTicket={onOpenTicket} /></section></div>
    </>}
  </section>;
}

export function StaffDashboard({ onOpenTicket }: { onOpenTicket: (ticketNumber: string) => void }) {
  const { authenticatedFetch } = useAuth();
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setState('loading'); setMessage('');
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/dashboard/staff`);
      if (!response.ok) throw new Error(await dashboardError(response));
      setData(await response.json() as StaffDashboardData); setState('ready');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load the dashboard.'); setState('error'); }
  }, [authenticatedFetch]);
  useEffect(() => { void load(); }, [load]);

  return <section className="dashboard-page staff-dashboard" aria-label="IT Staff Dashboard">
    <header className="dashboard-header"><div><h1>Staff Dashboard</h1><p>Operational counts and urgent Tickets from the authoritative service desk data.</p></div></header>
    {state === 'loading' && <p role="status">Loading dashboard...</p>}
    {state === 'error' && <div className="dashboard-state dashboard-error" role="alert"><p>{message}</p><button className="btn btn-outline-danger" onClick={() => void load()} type="button">Retry</button></div>}
    {state === 'ready' && data && <>
      <div className="dashboard-metrics"><article><strong>{data.metrics.unassignedTickets}</strong><span>Unassigned Tickets</span></article><article><strong>{data.metrics.myTickets}</strong><span>My Tickets</span></article><article><strong>{data.metrics.myActionsTaken}</strong><span>My Actions Taken (7d)</span></article><article><strong>{data.metrics.operationalTickets}</strong><span>Operational Tickets</span></article></div>
      <div className="dashboard-buckets"><section><h2>By status</h2><dl>{Object.entries(data.metrics.byStatus).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{value}</dd></div>)}</dl></section><section><h2>By IT priority</h2><dl>{Object.entries(data.metrics.byItPriority).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{value}</dd></div>)}</dl></section></div>
      <section className="dashboard-wide"><h2>Urgent and recently updated</h2><p className="dashboard-caption">Critical Tickets are listed first, followed by recent operational activity.</p><TicketLinks tickets={data.urgentTickets} onOpenTicket={onOpenTicket} /></section>
    </>}
  </section>;
}
