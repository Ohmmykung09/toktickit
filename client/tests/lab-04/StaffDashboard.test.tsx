import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { renderAuthenticated } from '../authenticated-render';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const dashboard = { metrics: { unassignedTickets: 2, myTickets: 4, myActionsTaken: 6, operationalTickets: 9, byStatus: { NEW: 2, OPEN: 3, IN_PROGRESS: 2, WAITING_FOR_REQUESTER: 1, REOPENED: 1 }, byItPriority: { LOW: 1, MEDIUM: 3, HIGH: 4, CRITICAL: 1 } }, urgentTickets: [{ ticketNumber: 'TKT-STAFF-DASH-1', summary: 'Core switch unavailable', status: 'IN_PROGRESS', itPriority: 'CRITICAL', updatedAt: '2026-09-30T08:00:00.000Z', drillDown: { type: 'staff-ticket', ticketNumber: 'TKT-STAFF-DASH-1' } }] };
const queue = { items: [], filters: { categories: [], relatedSystems: [], owners: [] }, pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } };

afterEach(() => vi.restoreAllMocks());
describe('Lab 4 IT Staff Dashboard UI', () => {
  it('loads metrics and opens an urgent Ticket through its drill-down', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(queue)).mockResolvedValueOnce(json(dashboard)).mockResolvedValueOnce(json({ ticketNumber: 'TKT-STAFF-DASH-1', summary: 'Core switch unavailable', description: 'Switch outage details.', requestedPriority: 'CRITICAL', itPriority: 'CRITICAL', status: 'IN_PROGRESS', updatedAt: '2026-09-30T08:00:00.000Z', createdAt: '2026-09-29T08:00:00.000Z', requesterResolutionIndicatedAt: null, requester: { id: 1, name: 'Aom', email: 'aom@example.test' }, owner: null, category: { id: 1, name: 'Network' }, relatedSystem: { id: 1, name: 'Core' }, attachments: [], publicComments: [], internalNotes: [], actionsTaken: [] })).mockResolvedValueOnce(json([]));
    renderAuthenticated(<App />, { user: { id: 6, name: 'Ploy IT', email: 'ploy.it@example.test', role: 'IT_STAFF' }, mustChangePassword: false, csrfToken: 'csrf' });
    await userEvent.click(await screen.findByRole('button', { name: 'Dashboard' }));
    expect(await screen.findByText('Unassigned Tickets')).toBeInTheDocument();
    expect(screen.getByText('Core switch unavailable')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open ticket' }));
    expect(await screen.findByRole('heading', { name: 'Core switch unavailable' })).toBeInTheDocument();
  });
});
