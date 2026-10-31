import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { renderAuthenticated } from '../authenticated-render';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const dashboard = { metrics: { openTickets: 3, waitingForRequester: 1, recentlyUpdatedCount: 2, recentlyResolvedCount: 1 }, attentionTickets: [{ ticketNumber: 'TKT-DASH-1', summary: 'Wi-Fi issue', status: 'WAITING_FOR_REQUESTER', updatedAt: '2026-09-30T08:00:00.000Z', drillDown: { type: 'ticket', ticketNumber: 'TKT-DASH-1' } }], recentTickets: [] };

afterEach(() => vi.restoreAllMocks());
describe('Lab 4 Requester Dashboard UI', () => {
  it('shows authoritative metric cards and drills into a ticket', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json([{ id: 1, name: 'Network' }])).mockResolvedValueOnce(json({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 } })).mockResolvedValueOnce(json(dashboard)).mockResolvedValueOnce(json({ ticketNumber: 'TKT-DASH-1', summary: 'Wi-Fi issue', description: 'A detailed Wi-Fi problem.', status: 'WAITING_FOR_REQUESTER', requestedPriority: 'HIGH', updatedAt: '2026-09-30T08:00:00.000Z', createdAt: '2026-09-29T08:00:00.000Z', requesterResolutionIndicatedAt: null, category: { id: 1, name: 'Network' }, relatedSystem: { id: 1, name: 'Wi-Fi' }, attachments: [], publicComments: [], actionsTaken: [] }));
    renderAuthenticated(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Open Dashboard' }));
    expect(await screen.findByText('Open Tickets')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open ticket' }));
    expect(await screen.findByRole('heading', { name: 'Wi-Fi issue' })).toBeInTheDocument();
  });

  it('shows an empty state and zero metrics when no dashboard data exists', async () => {
    const emptyDashboard = { metrics: { openTickets: 0, waitingForRequester: 0, recentlyUpdatedCount: 0, recentlyResolvedCount: 0 }, attentionTickets: [], recentTickets: [] };
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json([{ id: 1, name: 'Network' }]))
      .mockResolvedValueOnce(json({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 } }))
      .mockResolvedValueOnce(json(emptyDashboard));
    renderAuthenticated(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Open Dashboard' }));
    expect(await screen.findByText('No Tickets are currently waiting for your response.')).toBeInTheDocument();
    expect(screen.getByText('No Tickets were updated in the last 7 days.')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(4);
  });

  it('offers retry after a dashboard request fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json([{ id: 1, name: 'Network' }]))
      .mockResolvedValueOnce(json({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 } }))
      .mockResolvedValueOnce(json({ error: { message: 'Dashboard is temporarily unavailable.' } }, 503))
      .mockResolvedValueOnce(json(dashboard));
    renderAuthenticated(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Open Dashboard' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Dashboard is temporarily unavailable.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Wi-Fi issue')).toBeInTheDocument();
  });

  it('clears a dashboard drill-down when My Tickets is opened from navigation', async () => {
    const emptyTickets = { items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 } };
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json([{ id: 1, name: 'Network' }]))
      .mockResolvedValueOnce(json(emptyTickets))
      .mockResolvedValueOnce(json({ ...dashboard, metrics: { ...dashboard.metrics, recentlyResolvedCount: 1 } }))
      .mockResolvedValueOnce(json([{ id: 1, name: 'Network' }]))
      .mockResolvedValueOnce(json(emptyTickets))
      .mockResolvedValueOnce(json([{ id: 1, name: 'Network' }]))
      .mockResolvedValueOnce(json(emptyTickets));
    renderAuthenticated(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'Open Dashboard' }));
    await userEvent.click(await screen.findByRole('button', { name: 'View resolved Tickets' }));
    await screen.findByRole('heading', { name: 'My Tickets' });
    await userEvent.click(screen.getByRole('button', { name: 'Open My Tickets' }));
    expect(await screen.findByText('You have not created any tickets yet.')).toBeInTheDocument();

    const ticketListRequests = fetch.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes('/api/tickets?'));
    expect(ticketListRequests).toHaveLength(3);
    expect(new URL(ticketListRequests[1]).searchParams.get('resolvedSince')).toBe('7d');
    expect(new URL(ticketListRequests[2]).searchParams.has('resolvedSince')).toBe(false);
  });
});
