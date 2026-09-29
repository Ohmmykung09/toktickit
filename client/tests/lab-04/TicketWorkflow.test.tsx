import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { renderAuthenticated } from '../authenticated-render';

const staff = { user: { id: 6, name: 'Ploy IT', email: 'ploy.it@example.test', role: 'IT_STAFF' as const }, mustChangePassword: false, csrfToken: 'csrf' };
const assignees = [{ id: 6, name: 'Ploy IT', role: 'IT_STAFF' }];
const ticket = {
  ticketNumber: 'TKT-WORKFLOW-1',
  summary: 'Email access issue',
  description: 'The requester cannot access university email.',
  requestedPriority: 'HIGH',
  itPriority: 'MEDIUM',
  status: 'OPEN',
  createdAt: '2026-09-11T09:00:00.000Z',
  updatedAt: '2026-09-11T10:00:00.000Z',
  requesterResolutionIndicatedAt: null,
  requester: { id: 1, name: 'Aom S.', email: 'aom@example.test' },
  owner: { id: 6, name: 'Ploy IT', role: 'IT_STAFF' },
  category: { id: 1, name: 'Account and Access' },
  relatedSystem: { id: 1, name: 'Email' },
  attachments: [],
  publicComments: [],
  internalNotes: []
};
const queue = {
  items: [ticket],
  filters: { categories: [], relatedSystems: [], owners: assignees },
  pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function openTicket() {
  await userEvent.click(await screen.findByRole('button', { name: 'Open TKT-WORKFLOW-1' }));
  await screen.findByRole('heading', { name: 'Email access issue' });
}

afterEach(() => vi.restoreAllMocks());

describe('Lab 4 Ticket workflow UI', () => {
  it('shows only permitted transitions and hides forbidden workflow options', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(queue))
      .mockResolvedValueOnce(json(ticket))
      .mockResolvedValueOnce(json(assignees));
    renderAuthenticated(<App />, staff);
    await openTicket();

    const statusSelect = screen.getByRole('combobox', { name: 'Set ticket status' });
    expect(within(statusSelect).getByRole('option', { name: 'In Progress' })).toBeInTheDocument();
    expect(within(statusSelect).getByRole('option', { name: 'Cancelled' })).toBeInTheDocument();
    expect(within(statusSelect).queryByRole('option', { name: 'Closed' })).not.toBeInTheDocument();
  });

  it('shows resolution-gate feedback and refreshes the authoritative summary', async () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(queue))
      .mockResolvedValueOnce(json(ticket))
      .mockResolvedValueOnce(json(assignees))
      .mockResolvedValueOnce(json({ error: { code: 'RESOLUTION_ACTION_REQUIRED', message: 'Complete a qualifying Action Taken before resolving this Ticket.' } }, 409))
      .mockResolvedValueOnce(json(ticket))
      .mockResolvedValueOnce(json(assignees));
    renderAuthenticated(<App />, staff);
    await openTicket();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Set ticket status' }), 'RESOLVED');
    expect(await screen.findByRole('status')).toHaveTextContent('Complete a qualifying Action Taken before resolving this Ticket.');
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it('refreshes the Ticket summary after a successful permitted transition', async () => {
    const updated = { ...ticket, summary: 'Email access issue - updated', status: 'IN_PROGRESS', updatedAt: '2026-09-11T10:01:00.000Z' };
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(queue))
      .mockResolvedValueOnce(json(ticket))
      .mockResolvedValueOnce(json(assignees))
      .mockResolvedValueOnce(json(updated));
    renderAuthenticated(<App />, staff);
    await openTicket();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Set ticket status' }), 'IN_PROGRESS');
    expect(await screen.findByRole('heading', { name: 'Email access issue - updated' })).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Ticket updated.');
  });

  it('refreshes after a stale conflict and preserves actionable conflict feedback', async () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const refreshed = { ...ticket, status: 'CANCELLED', updatedAt: '2026-09-11T10:02:00.000Z' };
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(queue))
      .mockResolvedValueOnce(json(ticket))
      .mockResolvedValueOnce(json(assignees))
      .mockResolvedValueOnce(json({ error: { code: 'STALE_WRITE', message: 'The ticket changed. Reload it before saving again.' } }, 409))
      .mockResolvedValueOnce(json(refreshed))
      .mockResolvedValueOnce(json(assignees));
    renderAuthenticated(<App />, staff);
    await openTicket();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Set ticket status' }), 'CANCELLED');
    await waitFor(() => expect(screen.getByText('Cancelled')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('The ticket changed. Reload it before saving again.');
  });
});
